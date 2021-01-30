const {
  postAddContact,
  getContact,
  deleteContact,
  onContactList,
} = absoluteRequire('controllers/contact');

const { addContactValidator } = absoluteRequire('validators/contact');

const express = require('express');

const { Router } = express;

const route = Router();

route.post('/secured/contact', addContactValidator(), postAddContact);
route.get('/secured/contact', getContact);
route.get('/secured/contact/:contactId', onContactList);
route.delete('/secured/contact', deleteContact);

module.exports = route;
