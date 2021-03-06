import { SessionKey } from 'ch-node-session-handler/lib/session/keys/SessionKey';
import { SignInInfoKeys } from 'ch-node-session-handler/lib/session/keys/SignInInfoKeys';
import { ISignInInfo } from 'ch-node-session-handler/lib/session/model/SessionInterfaces';
import { Request } from 'express';
import { inject } from 'inversify';
import { provide } from 'inversify-binding-decorators';

import { FormActionProcessor } from 'app/controllers/processors/FormActionProcessor';
import { loggerInstance } from 'app/middleware/Logger';
import { ApplicationData, APPLICATION_DATA_KEY } from 'app/models/ApplicationData';
import { AppealStorageService } from 'app/service/AppealStorageService';

@provide(AppealStorageFormActionProcessor)
export class AppealStorageFormActionProcessor implements FormActionProcessor {

    constructor(@inject(AppealStorageService) private readonly appealStorageService: AppealStorageService) {
    }

    async process(req: Request): Promise<void> {

        const signInInfo = req.session
            .map(_ => _.getValue<ISignInInfo>(SessionKey.SignInInfo))
            .unsafeCoerce();

        const userId = signInInfo
            .map(info => info[SignInInfoKeys.UserProfile])
            .map(userProfile => userProfile?.id as string)
            .unsafeCoerce();

        const accessToken = signInInfo
            .map(info => info[SignInInfoKeys.AccessToken])
            .map(token => token?.access_token as string)
            .unsafeCoerce();

        const appeal = req.session
            .chain(_ => _.getExtraData())
            .map<ApplicationData>(data => data[APPLICATION_DATA_KEY])
            .map(data => data.appeal)
            .unsafeCoerce();

        loggerInstance()
            .debug(`${AppealStorageFormActionProcessor.name} - process: Saving appeal with data ${JSON.stringify(appeal)}`);
        loggerInstance()
            .info(`${AppealStorageFormActionProcessor.name} - process: Saving appeal for userId: ${userId}`);

        await this.appealStorageService.save(appeal, accessToken);
    }
}
