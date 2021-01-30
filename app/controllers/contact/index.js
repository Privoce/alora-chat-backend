const _ = require('lodash');
const { findUser, findOneUser, findOneUserByIdAndUpdate } = absoluteRequire(
  'repositories/user',
);
const { convertErrorToFrontFormat } = absoluteRequire('modules/utils');

/**
 * Get all loged user contacts
 * @param {Object} req express request objetc
 * @param {Object} res express response object
 */
async function getContact(req, res) {
  try {
    const { _id } = req.currentUser;

    const result = await findOneUser({
      _id,
    });

    if (result) {
      const users = await findUser(
        {
          _id: {
            $in: result.contacts.map(item => item.contactUserId),
          },
        },
        {
          password: false,
          contacts: false,
        },
      );

      res.status(200).json({
        success: true,
        result: users,
      });
    } else {
      res.status(500).json({
        success: false,
        errors: {},
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      errors: {},
    });
  }
}

/**
 * Check if contact is on loged user contacts list
 * @param {Object} req express request objetc
 * @param {Object} res express response object
 */
async function onContactList(req, res) {
  try {
    const { _id } = req.currentUser;
    const { contactId } = req.params;

    const result = await findOneUser({
      _id,
    });

    if (result) {
      if (
        result.contacts.find(
          userContacts => userContacts.contactUserId.toString() === contactId,
        )
      ) {
        res.status(200).json({
          success: true,
          result: true,
        });
      } else {
        res.status(200).json({
          success: false,
          result: false,
        });
      }
    } else {
      res.status(500).json({
        success: false,
        errors: {},
      });
    }
  } catch (e) {
    res.status(500).json({
      success: false,
      errors: {},
    });
  }
}

/**
 * Add new contact to loged user
 * @param {Object} req express request objetc
 * @param {Object} res express response object
 */
async function postAddContact(req, res) {
  const validationResult = await req.getValidationResult();
  const errors = convertErrorToFrontFormat(validationResult.mapped());

  const { email: contactUserNickname } = req.body;

  const { _id: contactOwnerId } = req.currentUser;

  if (!_.isEmpty(errors)) {
    res.status(400).json({
      success: false,
      errors,
    });
  } else {
    try {
      const contactUser = await findOneUser(
        {
          email: contactUserNickname,
        },
        {
          password: 0,
          contacts: 0,
        },
      );

      if (contactUser) {
        await findOneUserByIdAndUpdate(contactOwnerId, {
          $addToSet: {
            contacts: {
              contactUserId: contactUser._id,
            },
          },
        });
      }

      res.status(200).json({
        success: true,
        errors: {},
      });
    } catch (e) {
      res.status(500).json({
        success: false,
        errors: {},
      });
    }
  }
}

/**
 * Delete loged user contacts
 * @param {Object} req express request objetc
 * @param {Object} res express response object
 */
async function deleteContact(req, res) {
  const { contactId } = req.body;

  const { _id } = req.currentUser;

  try {
    await findOneUserByIdAndUpdate(_id, {
      $pull: {
        contacts: {
          contactUserId: contactId,
        },
      },
    });

    res.status(200).json({
      success: true,
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      errors: {},
    });
  }
}

module.exports = {
  getContact,
  postAddContact,
  deleteContact,
  onContactList,
};
