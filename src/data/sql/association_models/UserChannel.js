/*
 *
 * Junction table for User -> Channels
 * A channel can be anything,
 * Group, Public Chat, DM, etc.
 *
 */

import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

const UserChannel = sequelize.define('UserChannel', {
  lastRead: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  muted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
});

export default UserChannel;
