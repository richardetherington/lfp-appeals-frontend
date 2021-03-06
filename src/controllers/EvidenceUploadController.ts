import { SessionMiddleware } from 'ch-node-session-handler';
import { Request, Response } from 'express';
import { UNPROCESSABLE_ENTITY } from 'http-status-codes';
import { inject } from 'inversify';
import { controller } from 'inversify-express-utils';

import { BaseController, FormActionHandler, FormActionHandlerConstructor } from 'app/controllers/BaseController';
import { Validator } from 'app/controllers/validators/Validator';
import { AuthMiddleware } from 'app/middleware/AuthMiddleware';
import { FileTransferFeatureMiddleware } from 'app/middleware/FileTransferFeatureMiddleware';
import { Appeal } from 'app/models/Appeal';
import { ApplicationData, APPLICATION_DATA_KEY } from 'app/models/ApplicationData';
import { Attachment } from 'app/models/Attachment';
import { OtherReason } from 'app/models/OtherReason';
import { FileTransferService } from 'app/modules/file-transfer-service/FileTransferService';
import { UnsupportedFileTypeError } from 'app/modules/file-transfer-service/errors';
import { getEnvOrThrow } from 'app/utils/EnvironmentUtils';
import { parseFormData } from 'app/utils/MultipartFormDataParser';
import { EVIDENCE_UPLOAD_PAGE_URI, OTHER_REASON_PAGE_URI } from 'app/utils/Paths';
import { ValidationError } from 'app/utils/validation/ValidationError';
import { ValidationResult } from 'app/utils/validation/ValidationResult';

const maxNumberOfFiles: number = Number(getEnvOrThrow('MAX_NUMBER_OF_FILES'));

const template = 'evidence-upload';

const navigation = {
    previous(): string {
        return OTHER_REASON_PAGE_URI;
    },
    next(): string {
        return EVIDENCE_UPLOAD_PAGE_URI;
    }
};

const continueButtonValidator: Validator = {

    validate(request: Request): ValidationResult {

        const appeal: Appeal = request.session
            .chain(_ => _.getExtraData())
            .map<ApplicationData>(data => data[APPLICATION_DATA_KEY])
            .map(data => data.appeal)
            .unsafeCoerce();

        const attachments: Attachment[] | undefined = appeal.reasons.other.attachments;

        if (!attachments || attachments.length === 0) {
            return new ValidationResult([new ValidationError('file',
                'You must add a document or click “Continue without adding documents”')]);
        }
        return new ValidationResult([]);
    }
};

@controller(EVIDENCE_UPLOAD_PAGE_URI, SessionMiddleware, AuthMiddleware, FileTransferFeatureMiddleware)
export class EvidenceUploadController extends BaseController<OtherReason> {
    constructor(@inject(FileTransferService) private readonly fileTransferService: FileTransferService) {
        super(template, navigation, continueButtonValidator);
    }

    protected prepareViewModelFromAppeal(appeal: Appeal): Record<string, any> & OtherReason {
        return appeal.reasons?.other;
    }

    private async renderUploadError(appeal: Appeal, text: string): Promise<void> {
        const validationResult: ValidationResult = new ValidationResult([
            new ValidationError('file', text)
        ]);

        return await this.renderWithStatus(UNPROCESSABLE_ENTITY)(
            this.template, {
                ...this.prepareViewModelFromAppeal(appeal),
                ...this.httpContext.request.body,
                validationResult
            }
        );
    }

    protected getExtraActionHandlers(): Record<string, FormActionHandler | FormActionHandlerConstructor> {
        const that = this;

        const noFileSelectedError: string = 'Select a document to add to your application';
        const fileTooLargeError: string = 'File size must be smaller than 4MB';
        const fileNotSupportedError: string = 'The selected file must be a TXT, DOC, PDF, JPEG or PNG';
        const tooManyFilesError: string = `You can only select up to ${maxNumberOfFiles} files at the same time`;

        return {
            'upload-file': {
                async handle(request: Request, response: Response): Promise<void> {

                    const appeal: Appeal = request.session
                        .chain(_ => _.getExtraData())
                        .map<ApplicationData>(data => data[APPLICATION_DATA_KEY])
                        .map(data => data.appeal)
                        .unsafeCoerce();

                    try {
                        await parseFormData(request, response)
                    } catch (error) {
                        switch (error.code) {
                            case 'LIMIT_FILE_SIZE':
                                return await that.renderUploadError(appeal, fileTooLargeError);
                            case 'LIMIT_UNEXPECTED_FILE':
                                return await that.renderUploadError(appeal, fileNotSupportedError);
                        }
                    }

                    if (!request.file) {
                        return await that.renderUploadError(appeal, noFileSelectedError);
                    } else if (appeal.reasons.other.attachments &&
                        appeal.reasons.other.attachments!.length >= maxNumberOfFiles) {
                        return await that.renderUploadError(appeal, tooManyFilesError);
                    }

                    let id: string;

                    try {
                        id = await that.fileTransferService.upload(request.file.buffer, request.file.originalname);
                    } catch (err) {
                        if (err instanceof UnsupportedFileTypeError) {
                            return await that.renderUploadError(appeal, fileNotSupportedError);
                        } else {
                            throw err;
                        }
                    }

                    appeal.reasons.other.attachments = [...appeal.reasons.other.attachments || [], {
                        id, name: request.file.originalname, contentType: request.file.mimetype, size: request.file.size
                    }];

                    await that.persistSession();

                    response.redirect(request.route.path);
                }
            }
        };
    }
}
