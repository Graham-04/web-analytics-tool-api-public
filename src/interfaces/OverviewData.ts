export interface OverviewData {
    totalViews: {sum: number, previousPeriodDiff: number};
    topReferers: {
        referer: string;
        count: string;
    }[];
    topCountries: {
        countrycode: string;
        count: string;
    }[];
    topPages: {
        page: string;
        count: string;
    }[];
    uniqueVisitors: {sum: number, previousPeriodDiff: number};
    topBrowser: {
        browser: string;
        count: string;
    }[];
    labels: string[];
    data: number[];
    uniqueVisitorData: number[];
    avgDuration: string | null;
}