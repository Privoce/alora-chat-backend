const contactRoute = absoluteRequire('routes/contact');
const messageRoute = absoluteRequire('routes/message');
const videoCall = absoluteRequire('routes/videoCall');
const defaultRoute = absoluteRequire('routes/default');
const conversationRoute = absoluteRequire('routes/conversation');
const winstonMiddleware = absoluteRequire('middlewares/winston');
const jwtMiddleware = absoluteRequire('middlewares/jwt');

module.exports = app => {
  app.use('/', winstonMiddleware);
  app.use('/secured', jwtMiddleware);
  app.use(contactRoute);
  app.use(messageRoute);
  app.use(conversationRoute);
  app.use(videoCall);
  app.use(defaultRoute);
};
