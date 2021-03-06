import 'reflect-metadata'

import { Arg } from '@fluffy-spoon/substitute';
import * as assert from 'assert';
import { Maybe, Session } from 'ch-node-session-handler';
import { SessionKey } from 'ch-node-session-handler/lib/session/keys/SessionKey';
import { SignInInfoKeys } from 'ch-node-session-handler/lib/session/keys/SignInInfoKeys';
import { IAccessToken, ISignInInfo } from 'ch-node-session-handler/lib/session/model/SessionInterfaces';
import { Request } from 'express';

import { AppealStorageFormActionProcessor } from 'app/controllers/processors/AppealStorageFormActionProcessor';
import { Appeal } from 'app/models/Appeal';
import { APPLICATION_DATA_KEY } from 'app/models/ApplicationData';
import { AppealStorageService } from 'app/service/AppealStorageService';

import { createSubstituteOf } from 'test/SubstituteFactory';

describe('AppealStorageForSubmissionProcessor', () => {

    const appealStorageService = createSubstituteOf<AppealStorageService>();

    const processor = new AppealStorageFormActionProcessor(appealStorageService);

    const appeal: Appeal = {
        penaltyIdentifier: {
            companyNumber: '00345567',
            penaltyReference: 'A00000001',
        },
        reasons: {
            other: {
                title: 'I have reasons',
                description: 'they are legit'
            }
        }
    };

    const token: string = 'abc';

    it('should throw error when session does not exist', async () => {

        try {
            await processor.process({session: Maybe.empty() as Maybe<Session>} as Request);
            assert.fail();
        } catch (err) {
            assert.equal(err.message, 'Maybe got coerced to a null');
        }

        appealStorageService.didNotReceive().save(Arg.any(), Arg.any());
    });

    it('should store appeal', async () => {

        await processor.process({
            session: Maybe.of(
                new Session({
                    [SessionKey.SignInInfo]: {
                        [SignInInfoKeys.AccessToken]: {
                            access_token: token
                        } as IAccessToken
                    } as ISignInInfo,
                    [SessionKey.ExtraData]: {
                        [APPLICATION_DATA_KEY]: {
                           appeal
                        }
                    }
                })
            )
        } as Request);

        appealStorageService.received().save(appeal, token);
    })
});
