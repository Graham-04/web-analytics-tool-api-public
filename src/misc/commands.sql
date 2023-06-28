CREATE TABLE IF NOT EXISTS Websites
(
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostname VARCHAR(255) UNIQUE

);


CREATE TABLE IF NOT EXISTS HourlyPageViews
(
    websiteId    UUID REFERENCES Websites (id) NOT NULL,
    hour         TIMESTAMPTZ                   NOT NULL,
    views        INTEGER                       NOT NULL DEFAULT 0,
    uniqueViews  INTEGER                       NOT NULL DEFAULT 0,
    referers     JSONB                                  DEFAULT '{}',
    pages        JSONB                                  DEFAULT '{}',
    countryCodes JSONB                                  DEFAULT '{}',
    browsers     JSONB                                  DEFAULT '{}',
    PRIMARY KEY (websiteId, hour)
);




CREATE TABLE IF NOT EXISTS UserHashes
(
    websiteId UUID REFERENCES Websites (id) NOT NULL,
    userHash  VARCHAR(129) UNIQUE           NOT NULL,
    PRIMARY KEY (websiteId, userHash)
);


CREATE TABLE IF NOT EXISTS UserDuration
(
    userHash    VARCHAR(129) REFERENCES UserHashes (userHash) NOT NULL,
    websiteId   UUID REFERENCES Websites (id)                 NOT NULL,
    startTime   TIMESTAMPTZ                                   NOT NULL,
    endTime     TIMESTAMPTZ                                   NOT NULL,
    idleTimeout INTEGER                                       NOT NULL DEFAULT 0,
    PRIMARY KEY (userHash, websiteId, startTime, idleTimeout)
);

CREATE TABLE IF NOT EXISTS Role
(
    id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS UserRole
(
    websiteId UUID REFERENCES Websites (id) NOT NULL,
    userId    VARCHAR(64)                   NOT NULL,
    roleId    UUID REFERENCES Role (id)     NOT NULL,
    PRIMARY KEY (websiteId, userId)
);

