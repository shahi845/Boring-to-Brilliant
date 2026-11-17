/**
 * Registries filled in by feature modules at load time.
 * Kept in a dependency-free module so they exist before any feature module runs.
 */
export const PAGES = {}; // page name -> () => html
export const HOMES = {}; // role -> () => html for the home screen
export const FORMS = {}; // form id -> (values, formElement) => void | error
