import { Session, SessionMiddleware } from 'ch-node-session-handler';
import { SessionKey } from 'ch-node-session-handler/lib/session/keys/SessionKey';
import { SignInInfoKeys } from 'ch-node-session-handler/lib/session/keys/SignInInfoKeys';
import { ISignInInfo } from 'ch-node-session-handler/lib/session/model/SessionInterfaces';
import { controller } from 'inversify-express-utils';

import { SafeNavigationBaseController } from 'app/controllers/SafeNavigationBaseController';
import { AppealStorageFormActionProcessor } from 'app/controllers/processors/AppealStorageFormActionProcessor';
import { InternalEmailFormActionProcessor } from 'app/controllers/processors/InternalEmailFormActionProcessor';
import { UserEmailFormActionProcessor } from 'app/controllers/processors/UserEmailFormActionProcessor';
import { AuthMiddleware } from 'app/middleware/AuthMiddleware';
import { loggerInstance } from 'app/middleware/Logger';
import { Appeal } from 'app/models/Appeal';
import { getEnvOrThrow } from 'app/utils/EnvironmentUtils';
import { CHECK_YOUR_APPEAL_PAGE_URI, CONFIRMATION_PAGE_URI, OTHER_REASON_PAGE_URI } from 'app/utils/Paths';
import { Region } from 'app/utils/RegionLookup';

const template = 'check-your-appeal';

const navigation = {
    previous(): string {
        return OTHER_REASON_PAGE_URI;
    },
    next(): string {
        return CONFIRMATION_PAGE_URI;
    }
};

@controller(CHECK_YOUR_APPEAL_PAGE_URI, SessionMiddleware, AuthMiddleware)
export class CheckYourAppealController extends SafeNavigationBaseController<any> {
    constructor() {
        super(template, navigation, undefined, undefined, [AppealStorageFormActionProcessor,
            InternalEmailFormActionProcessor, UserEmailFormActionProcessor]);
        // tslint:disable-next-line: forin
        for (const region in Region) {
            getEnvOrThrow(`${region}_TEAM_EMAIL`);
        }
    }

    protected prepareViewModelFromSession(session: Session): Record<string, any> {
        const userProfile = session.getValue<ISignInInfo>(SessionKey.SignInInfo)
            .map(info => info[SignInInfoKeys.UserProfile])
            .unsafeCoerce();

        const model = {
            ...super.prepareViewModelFromSession(session),
            userProfile
        };
        loggerInstance()
            .debug(`${CheckYourAppealController.name} - prepareViewModelFromSession: ${JSON.stringify(model)}`);

        return model;
    }

    protected prepareViewModelFromAppeal(appeal: Appeal): any {
        return appeal;
    }
}
