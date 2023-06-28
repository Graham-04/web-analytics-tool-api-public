import { hashPassword, comparePassword } from "./hashing";
import logger from "./logging";
import sqlPool from "./sqlConnPool";
import { OverviewData } from "../interfaces/OverviewData";
const { DateTime } = require("luxon");

// TODO: Look into duplicate primary key errors

class SQL {
  async getAllWebsites() {
    const query = {
      name: "get-all-websites",
      text: "SELECT * FROM websites;",
    };
    const websites = await sqlPool.query(query);
    if (!websites) {
      throw new Error("Could not get website IDs");
    }
    return websites.rows;
  }

  async getHostnameFromWebsiteId(websiteId: string) {
    const query = {
      name: "get-hostname-from-websiteId",
      text: "SELECT hostname FROM websites WHERE id = $1;",
      values: [websiteId],
    };
    const result = await sqlPool.query(query);
    return result.rows[0].hostname;
  }

  async getAllWebsitesByUserId(userId: string | undefined) {
    const roleId = await this.getRoleId("admin");
    // userId = userId?.split('@')[0];
    const query = {
      name: "get-all-websites-by-userId",
      text: "SELECT * FROM userRole WHERE userId = $1 AND roleID = $2;",
      values: [userId, roleId],
    };
    const result = await sqlPool.query(query);
    let hostnames = [];
    for (let website of result.rows) {
      const hostname = await this.getHostnameFromWebsiteId(website.websiteid);
      hostnames.push(hostname);
    }
    return hostnames;
  }

  async getRolesByUserId(userId: string) {
    const query = {
      name: "get-roles-by-userId",
      text: "SELECT * FROM userRole WHERE userId = $1",
      values: [userId],
    };

    const roles = await sqlPool.query(query);
    return roles;
  }

  async generateLineChartData(websiteId: string, start: string, end: string = "NOW()"): Promise<{ labels: string[]; data: number[] }> {
    const query = {
      name: "get-linechart-data",
      text: "SELECT hour, views FROM hourlyPageViews WHERE websiteId = $1 AND hour BETWEEN $2 AND $3 ORDER BY hour ASC",
      values: [websiteId, start, end],
    };

    const result = await sqlPool.query(query);
    let labels: string[] = [];
    let data: number[] = [];

    if (result.rows.length >= 1) {
      result.rows.forEach((row: any) => {
        let isoString = row.hour.toISOString();
        const inputDate = DateTime.fromISO(isoString);
        const formattedDate = inputDate.toFormat("M/d/yy h:mma");
        labels.push(formattedDate);
        data.push(row.views);
      });
    }

    return { labels, data };
  }

  async generateSparkLineData(websiteId: string, start: string, end: string) {
    // "total views" sparkline just uses the lineChartData
    // gets the same data as generateLineChartData, but gets an array of unique visitors, and eventually an array for user duration
    const uniqueViewsQuery = {
      name: "get-unique-views",
      text: "SELECT uniqueViews FROM hourlyPageViews WHERE websiteId = $1 AND hour BETWEEN $2 AND $3 ORDER BY hour ASC",
      values: [websiteId, start, end],
    };

    const uniqueViewsResult = await sqlPool.query(uniqueViewsQuery);
    // put numbers into array
    let uniqueViews: number[] = [];
    uniqueViewsResult.rows.forEach((row: any) => {
      uniqueViews.push(row.uniqueviews);
    });
    console.log("uniqueViewsResult:", uniqueViews);
    return uniqueViews;
  }

  async getAvgUserDuration(websiteId: string, start: string, end: string = "NOW()"): Promise<string> {
    const avgUserDurationQuery = {
      name: "get-avg-user-duration",
      text: `SELECT AVG(EXTRACT(EPOCH FROM (endTime - startTime))) AS average_duration FROM UserDuration WHERE websiteId = $1 AND startTime >= $2 AND endTime <= $3;`,
      values: [websiteId, start, end],
    };
    const avgUserDurationResult = await sqlPool.query(avgUserDurationQuery);
    return avgUserDurationResult.rows[0].average_duration;
  }

  /**
   * Retrieves analytics overview data for a specific website within a given timeframe.
   * @param {string} websiteId - The ID of the website.
   * @param {string} userId - The ID of the user.
   * @param {string} start - The start date and time in the format 'YYYY-MM-DD HH:mm'.
   * @param {string} end - The end date and time in the format 'YYYY-MM-DD HH:mm'.
   * @returns {Promise<AnalyticsData>} A promise that resolves to an object containing analytics data.
   */
  async getOverview(websiteId: string, userId: string | undefined, start: string, end: string = "NOW() "): Promise<OverviewData | null> {
    const sparkLineData = await this.generateSparkLineData(websiteId, start, end);

    console.log("start:", start);
    console.log("end:", end);

    // convert to luxon DateTime (ISO)
    const startDateTime = DateTime.fromFormat(start, "yyyy-MM-dd HH:mm");
    const endDateTime = DateTime.fromFormat(end, "yyyy-MM-dd HH:mm");

    // get the total days in the period
    let totalDays = Math.round(endDateTime.diff(startDateTime, "days").days);
    if (totalDays == 0) {
      totalDays = 1;
    }
    console.log("totalDays:", totalDays);

    // start - the total days in the period = start of previous period
    const startOfPrevPeriod = startDateTime.minus({ days: totalDays }).toFormat("yyyy-MM-dd HH:mm");
    const endOfPrevPeriod = endDateTime.minus({ days: totalDays }).toFormat("yyyy-MM-dd HH:mm");

    console.log("startOfPrevPeriod:", startOfPrevPeriod);
    console.log("endOfPrevPeriod:", endOfPrevPeriod);

    const { labels, data } = await this.generateLineChartData(websiteId, start, end);
    console.log("labels:", labels);
    console.log("data:", data);
    if (!userId) {
      return null;
    }
    // verify user has role
    logger.info(`Verifying user has role userId: ${userId} websiteId: ${websiteId}`);
    const role = await this.verifyUserHasRole(userId, websiteId, "admin");
    logger.info(`Role: ${role}`);
    if (!role) {
      logger.info("Role for user not found");
      return null;
    }

    // TODO: IN UTC time, but modify to accept other timezones
    const totalViewsQuery = {
      name: "get-total-views",
      text: "SELECT SUM(views) FROM hourlyPageViews WHERE websiteId = $1 AND hour BETWEEN $2 AND $3;",
      values: [websiteId, start, end],
    };

    const totalViewsPrev = {
      name: "get-total-views-prev",
      text: "SELECT SUM(views) FROM hourlyPageViews WHERE websiteId = $1 AND hour BETWEEN $2 AND $3;",
      values: [websiteId, startOfPrevPeriod, endOfPrevPeriod],
    };

    const topReferersQuery = {
      name: "get-top-referers",
      text: `SELECT key AS referer, SUM(value::INT) FROM hourlyPageViews, jsonb_each_text(referers) WHERE websiteId = $1 AND hour BETWEEN $2 AND $3 GROUP BY key ORDER BY SUM(value::INT)`,
      values: [websiteId, start, end],
    };

    const topReferersPrev = {
      name: "get-top-referers-prev",
      text: `SELECT key AS referer, SUM(value::INT) FROM hourlyPageViews, jsonb_each_text(referers) WHERE websiteId = $1 AND hour BETWEEN $2 AND $3 GROUP BY key ORDER BY SUM(value::INT)`,
      values: [websiteId, startOfPrevPeriod, endOfPrevPeriod],
    };

    const topCountriesQuery = {
      name: "get-top-countries",
      text: "SELECT key AS countrycode, SUM(value::INT) FROM hourlyPageViews, jsonb_each_text(countrycodes) WHERE websiteId = $1 AND hour BETWEEN $2 AND $3 GROUP BY key ORDER BY SUM(value::INT)",
      values: [websiteId, start, end],
    };

    const topCountriesPrev = {
      name: "get-top-countries-prev",
      text: "SELECT key AS countrycode, SUM(value::INT) FROM hourlyPageViews, jsonb_each_text(countrycodes) WHERE websiteId = $1 AND hour BETWEEN $2 AND $3 GROUP BY key ORDER BY SUM(value::INT)",
      values: [websiteId, startOfPrevPeriod, endOfPrevPeriod],
    };

    const topPagesQuery = {
      name: "get-top-pages",
      text: "SELECT key AS page, SUM(value::INT) FROM hourlyPageViews, jsonb_each_text(pages) WHERE websiteId = $1 AND hour BETWEEN $2 AND $3 GROUP BY key ORDER BY SUM(value::INT)",
      values: [websiteId, start, end],
    };

    const topPagesPrev = {
      name: "get-top-pages-prev",
      text: "SELECT key AS page, SUM(value::INT) FROM hourlyPageViews, jsonb_each_text(pages) WHERE websiteId = $1 AND hour BETWEEN $2 AND $3 GROUP BY key ORDER BY SUM(value::INT)",
      values: [websiteId, startOfPrevPeriod, endOfPrevPeriod],
    };

    const uniqueVisitorsQuery = {
      name: "get-unique-visitors",
      text: "SELECT SUM(uniqueviews) FROM hourlyPageViews WHERE websiteId = $1 AND hour BETWEEN $2 AND $3",
      values: [websiteId, start, end],
    };

    const uniqueVisitorsPrev = {
      name: "get-unique-visitors-prev",
      text: "SELECT SUM(uniqueviews) FROM hourlyPageViews WHERE websiteId = $1 AND hour BETWEEN $2 AND $3",
      values: [websiteId, startOfPrevPeriod, endOfPrevPeriod],
    };

    const topBrowserQuery = {
      name: "get-top-browser",
      text: "SELECT key AS browser, SUM(value::INT) FROM hourlyPageViews, jsonb_each_text(browsers) WHERE websiteId = $1 AND hour BETWEEN $2 AND $3 GROUP BY key ORDER BY SUM(value::INT)",
      values: [websiteId, start, end],
    };

    const topBrowserPrev = {
      name: "get-top-browser-prev",
      text: "SELECT key AS browser, SUM(value::INT) FROM hourlyPageViews, jsonb_each_text(browsers) WHERE websiteId = $1 AND hour BETWEEN $2 AND $3 GROUP BY key ORDER BY SUM(value::INT)",
      values: [websiteId, startOfPrevPeriod, endOfPrevPeriod],
    };

    const totalViews = await sqlPool.query(totalViewsQuery);
    const topReferers = await sqlPool.query(topReferersQuery);
    const topCountries = await sqlPool.query(topCountriesQuery);
    const topPages = await sqlPool.query(topPagesQuery);
    const uniqueVisitors = await sqlPool.query(uniqueVisitorsQuery);
    const topBrowser = await sqlPool.query(topBrowserQuery);
    const avgDuration = await this.getAvgUserDuration(websiteId, start, end);


    const totalViewsPrevResult = await sqlPool.query(totalViewsPrev);
    const topReferersPrevResult = await sqlPool.query(topReferersPrev);
    const topCountriesPrevResult = await sqlPool.query(topCountriesPrev);
    const topPagesPrevResult = await sqlPool.query(topPagesPrev);
    const uniqueVisitorsPrevResult = await sqlPool.query(uniqueVisitorsPrev);
    const topBrowserPrevResult = await sqlPool.query(topBrowserPrev);

    // calculate percentage differences
    const totalViewsDiff = totalViewsPrevResult.rows[0].sum > 0 ? parseFloat((((totalViews.rows[0].sum - totalViewsPrevResult.rows[0].sum) / totalViewsPrevResult.rows[0].sum) * 100).toFixed(1)) : 0;
    const uniqueVisitorsDiff =
      uniqueVisitorsPrevResult.rows[0].sum > 0 ? parseFloat((((uniqueVisitors.rows[0].sum - uniqueVisitorsPrevResult.rows[0].sum) / uniqueVisitorsPrevResult.rows[0].sum) * 100).toFixed(1)) : 0;


    // calculate differences
    topReferers.rows.forEach((row: any, index: number) => {
      const prevRow = topReferersPrevResult.rows.find((prevRow: any) => prevRow.referer === row.referer);
      if (prevRow) {
        const diff = prevRow.sum > 0 ? ((row.sum - prevRow.sum) / prevRow.sum) * 100 : 0;
        row.previousPeriodValue = parseFloat(prevRow.sum);
        row.previousPeriodDiff = parseFloat(diff.toFixed(1));
      } else {
        row.previousPeriodValue = 0;
        row.previousPeriodDiff = 0;
      }
    });

    topCountries.rows.forEach((row: any, index: number) => {
      const prevRow = topCountriesPrevResult.rows.find((prevRow: any) => prevRow.countrycode === row.countrycode);
      if (prevRow) {
        const diff = prevRow.sum > 0 ? ((row.sum - prevRow.sum) / prevRow.sum) * 100 : 0;
        row.previousPeriodValue = parseFloat(prevRow.sum);
        row.previousPeriodDiff = parseFloat(diff.toFixed(1));
      } else {
        row.previousPeriodValue = 0;
        row.previousPeriodDiff = 0;
      }
    });

    topPages.rows.forEach((row: any, index: number) => {
      const prevRow = topPagesPrevResult.rows.find((prevRow: any) => prevRow.page === row.page);
      if (prevRow) {
        const diff = prevRow.sum > 0 ? ((row.sum - prevRow.sum) / prevRow.sum) * 100 : 0;
        row.previousPeriodValue = parseFloat(prevRow.sum);
        row.previousPeriodDiff = parseFloat(diff.toFixed(1));
      } else {
        row.previousPeriodValue = 0;
        row.previousPeriodDiff = 0;
      }
    });

    topBrowser.rows.forEach((row: any, index: number) => {
      const prevRow = topBrowserPrevResult.rows.find((prevRow: any) => prevRow.browser === row.browser);
      if (prevRow) {
        const diff = prevRow.sum > 0 ? ((row.sum - prevRow.sum) / prevRow.sum) * 100 : 0;
        row.previousPeriodValue = parseFloat(prevRow.sum);
        row.previousPeriodDiff = parseFloat(diff.toFixed(1));
      } else {
        row.previousPeriodValue = 0;
        row.previousPeriodDiff = 0;
      }
    });

    return {
      totalViews: { sum: totalViews.rows[0].sum, previousPeriodDiff: totalViewsDiff },
      topReferers: topReferers.rows,
      topCountries: topCountries.rows,
      topPages: topPages.rows,
      uniqueVisitors: { sum: uniqueVisitors.rows[0].sum, previousPeriodDiff: uniqueVisitorsDiff },
      topBrowser: topBrowser.rows,
      avgDuration: avgDuration ? parseFloat(avgDuration).toFixed(2) : avgDuration,
      uniqueVisitorData: sparkLineData,
      labels: labels,
      data: data,
    };
  }

  async generateTestHours(websiteId: string, hours: number): Promise<void> {
    // Define possible options
    const pages = ["/home", "/settings", "/login", "/sign-up"];
    const browsers = ["firefox", "chrome", "safari", "edge", "opera"];
    const countryCodes = ["US", "UK", "FR", "DE", "JP", "CN"];
    const referers = ["Direct", "Google", "Facebook", "Twitter", "LinkedIn", "Instagram", "Otherwebsite.com", "Company.io", "AnotherWebsite.net", "University.edu"];
  
    for (let i = 0; i < hours; i++) {
      const startTime = DateTime.now().minus({ hours: i }).startOf("hour");
      const endTime = DateTime.now().minus({ hours: i }).plus({ minutes: Math.floor(Math.random() * 60) }); // Random end time within the hour
      const hour = startTime.toFormat("yyyy-MM-dd HH:mm");
  
      // Generate JSON objects as string with all options
      const referersJSON = JSON.stringify(referers.reduce((obj, referer) => ({ ...obj, [referer]: Math.floor(Math.random() * 10) }), {}));
      const pagesJSON = JSON.stringify(pages.reduce((obj, page) => ({ ...obj, [page]: Math.floor(Math.random() * 10) }), {}));
      const countryCodesJSON = JSON.stringify(countryCodes.reduce((obj, countryCode) => ({ ...obj, [countryCode]: Math.floor(Math.random() * 10) }), {}));
      const browsersJSON = JSON.stringify(browsers.reduce((obj, browser) => ({ ...obj, [browser]: Math.floor(Math.random() * 10) }), {}));
  
      const userHash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); 
  
      const query0 = {
        text: `
          INSERT INTO UserHashes (userHash, websiteId)
          VALUES ($1, $2)
          ON CONFLICT (userHash, websiteId) DO NOTHING
        `,
        values: [userHash, websiteId]
      };
  
      await sqlPool.query(query0);
  
      const query1 = {
        text: `
          INSERT INTO HourlyPageViews (websiteId, hour, views, uniqueViews, referers, pages, countryCodes, browsers) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        values: [
          websiteId,
          hour,
          Math.floor(Math.random() * 100), 
          Math.floor(Math.random() * 100),
          referersJSON,
          pagesJSON,
          countryCodesJSON,
          browsersJSON,
        ],
      };
  
      await sqlPool.query(query1);
  
      const query2 = {
        text: `
          INSERT INTO UserDuration (userHash, websiteId, startTime, endTime, idleTimeout) 
          VALUES ($1, $2, $3, $4, $5)
        `,
        values: [
          userHash,
          websiteId,
          startTime.toFormat("yyyy-MM-dd HH:mm"),
          endTime.toFormat("yyyy-MM-dd HH:mm"),
          1, 
        ],
      };
  
      await sqlPool.query(query2);
    }
  }
  



  async getAllUserHashesByWebsiteId(websiteId: string, start: string = "2023-05-26", end: string = "NOW()"): Promise<Array<string>> {
    const query = {
      name: "get-all-user-hashes",
      text: "SELECT DISTINCT userHash FROM userHashes WHERE websiteId = $1", 
      values: [websiteId],
    };
    const hashes = await sqlPool.query(query);
    let hashArray: string[] = hashes.rows.map((hash: { userhash: string }) => hash.userhash);
    return hashArray;
  }

  async getWebsiteIdFromHostname(hostname: string) {
    const query = {
      name: "get-websiteId-from-hostname",
      text: "SELECT id FROM websites WHERE hostname = $1",
      values: [hostname],
    };
    const result = await sqlPool.query(query);
    if (!result.rows[0]) {
      logger.error(`Website with hostname ${hostname} does not exist.`);
      return null;
    }
    return result.rows[0].id;
  }

  async getRoleId(name: string) {
    const query = {
      name: "get-roleId",
      text: "SELECT id FROM role WHERE name = $1",
      values: [name],
    };
    const result = await sqlPool.query(query);
    if (!result.rows[0]) {
      logger.error(`Role with name ${name} does not exist.`);
      return null;
    }
    return result.rows[0].id;
  }

  async addWebsite(hostname: string) {
    const query = {
      name: "add-website",
      text: "INSERT INTO websites (hostname) VALUES ($1)",
      values: [hostname],
    };
    const result = await sqlPool.query(query);
    logger.info(`Added website with hostname ${hostname} ${result}`);
    return result.rowCount;
  }

  async registerWebsite(hostname: string, userId: string) {
    let websiteId = await this.getWebsiteIdFromHostname(hostname);
    if (!websiteId) {
      logger.info(`Website with hostname ${hostname} does not exist. Creating new website.`);
      await this.addWebsite(hostname);
      logger.info(`Getting website id for ${hostname}`);
      websiteId = await this.getWebsiteIdFromHostname(hostname);
    }
    logger.info(`Getting role id "admin"`);
    const roleId = await this.getRoleId("admin");
    if (!roleId) {
      return null;
    }
    // userId = userId.split("@")[0];
    const query = {
      name: "register-website",
      text: "INSERT INTO userRole (websiteId, userId, roleId) VALUES ($1, $2, $3)",
      values: [websiteId, userId, roleId],
    };

    const result = await sqlPool.query(query);
    return result.rowCount;
  }

  async verifyUserHasRole(userId: string, websiteId: string, roleName: string): Promise<boolean> {
    logger.info(`Verifying user ${userId} has role ${roleName} on website ${websiteId}`);
    // userId = userId.split("@")[0];
    const query = {
      name: "check-for-user-role",
      text: "SELECT * FROM userRole WHERE userId = $1 AND websiteID = $2 AND roleId = (SELECT id FROM role WHERE name = $3)",
      values: [userId, websiteId, roleName],
    };
    const result = await sqlPool.query(query);
    return result.rowCount > 0;
  }
}

export default new SQL();
