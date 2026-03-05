/**
 * Since exports from './constants' are: the MessageType enum and a lot of types,
 * and imports there are types only, so it should not affect bundle size
 */
// eslint-disable-next-line no-restricted-syntax
export * from './constants';
export { sendMessage, sendTabMessage } from './send-message';
export { MessageHandler, messageHasTypeField, messageHasTypeAndDataFields } from './message-handler';
