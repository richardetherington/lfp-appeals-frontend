import { SessionKey } from 'ch-node-session-handler/lib/session/keys/SessionKey';
import { SignInInfoKeys } from 'ch-node-session-handler/lib/session/keys/SignInInfoKeys';
import { ISignInInfo, IUserProfile } from 'ch-node-session-handler/lib/session/model/SessionInterfaces';
import { Request } from 'express';
import { inject } from 'inversify';
import { provide } from 'inversify-binding-decorators';

import { FormActionProcessor } from 'app/controllers/processors/FormActionProcessor';
import { loggerInstance } from 'app/middleware/Logger';
import { Appeal } from 'app/models/Appeal';
import { ApplicationData, APPLICATION_DATA_KEY } from 'app/models/ApplicationData';
import { Email } from 'app/modules/email-publisher/Email';
import { EmailService } from 'app/modules/email-publisher/EmailService';

function buildEmail(userProfile: IUserProfile, appeal: Appeal): Email {
    return {
        to: userProfile.email as string,
        subject: `Confirmation of your appeal - ${appeal.penaltyIdentifier.companyNumber} - Companies House`,
        body: {
            templateName: 'lfp-appeal-submission-confirmation',
            templateData: {
                companyNumber: appeal.penaltyIdentifier.companyNumber,
                userProfile: {
                    email: userProfile.email
                }
            }
        }
    };
}

@provide(UserEmailFormActionProcessor)
export class UserEmailFormActionProcessor implements FormActionProcessor {
    constructor(@inject(EmailService) private readonly emailService: EmailService) { }

    async process(req: Request): Promise<void> {
        const userProfile = req.session
            .chain(_ => _.getValue<ISignInInfo>(SessionKey.SignInInfo))
            .map(info => info[SignInInfoKeys.UserProfile])
            .unsafeCoerce() as IUserProfile;

        const applicationData: ApplicationData = req.session
            .chain(_ => _.getExtraData())
            .map(data => data[APPLICATION_DATA_KEY] as ApplicationData)
            .unsafeCoerce();

        const email = buildEmail(userProfile, applicationData.appeal);

        await this.emailService.send(email)
            .catch(_ => {
                loggerInstance().error(`${UserEmailFormActionProcessor.name} - process: email=${JSON.stringify(email)}, error=${_}`);
                throw _
            });

    }
}
