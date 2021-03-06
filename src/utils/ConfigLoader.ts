import bodyParser = require('body-parser');
import { createLoggerMiddleware } from 'ch-logging';
import cookieParser = require('cookie-parser');
import * as dotenv from 'dotenv';
import * as express from 'express';
import * as nunjucks from 'nunjucks';
import * as path from 'path';

import { getEnv, getEnvOrThrow } from 'app/utils/EnvironmentUtils';
import * as Paths from 'app/utils/Paths';

const DEFAULT_ENV_FILE = `${__dirname}/../../.env`;

const checkFileExists = (config: dotenv.DotenvConfigOutput) => {
    if (config.error) throw config.error;
    else return config;
};

export const APP_NAME = 'lfp-appeals-frontend';

export const loadEnvironmentVariablesFromFiles = () => {
    dotenv.config({ path: DEFAULT_ENV_FILE });
    if (process.env.NODE_ENV) {
        const envFilePath = `${__dirname}/../../.env.${process.env.NODE_ENV}`;
        checkFileExists(dotenv.config({ path: envFilePath }));
    }
};

export const getExpressAppConfig = (directory: string) => (app: express.Application): void => {
    app.use(Paths.ROOT_URI, express.static(path.join(directory, '/node_modules/govuk-frontend')));
    app.use(Paths.ROOT_URI, express.static(path.join(directory, '/node_modules/govuk-frontend/govuk')));

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());

    const loggingMiddleware = createLoggerMiddleware(APP_NAME);
    app.use(loggingMiddleware);

    app.set('view engine', 'njk');
    nunjucks.configure([
        'dist/views',
        'node_modules/govuk-frontend',
        'node_modules/govuk-frontend/components',
    ], {
        autoescape: true,
        express: app,
    });

    app.locals.paths = Paths;
    app.locals.ui = {
        createChangeLinkConfig: (uri: string, accessibleName: string) => {
            return {
                href: `${uri}?cm=1`,
                text: 'Change',
                visuallyHiddenText: accessibleName
            };
        }
    };

    app.locals.cdn = {
        host: getEnvOrThrow('CDN_HOST')
    };

    const url = getEnv('PIWIK_URL');
    const site = getEnv('PIWIK_SITE_ID');
    if (url && site) {
        app.locals.piwik = { url, site };
    }
};

