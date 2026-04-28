/*
 * context for context menus
 */
import { createContext } from 'react';

const MenuContext = createContext();
/*
 * {
 *   openMenuId,
 *   openMenu(type, x, y, align, args, id),
 * }
 */

export default MenuContext;
