/*
 * Describes ONE master-data list screen and how it DIFFERS from the standard screen.
 * A difference listed in "differs" makes the matching standard test run as a
 * "known issue" (test.fail) so it is reported, not hidden.
 */
export type Screen = {
  entity: string;        // singular name used in buttons/messages: "State"
  plural: string;        // page heading: "States"
  path: string;          // URL
  menu?: string;         // menu text, if different from entity (e.g. "Supplements")
  nameCol?: number;      // column that holds the Name (default 1)
  sample?: string;       // an ACTIVE record that exists (for search / edit / popup checks)
  required?: string[];   // required fields besides Name (must show "<field> is required")
  nameFromList?: boolean; // Name is picked from a fixed list (like Country / Currency) -> free-typing tests are skipped
  addLabel?: string;     // text on the Add button if not "Add <entity>"
  differs?: {
    menuName?: string;
    noAdd?: string;
    noEdit?: string;
    noAudit?: string;
    emptyMessage?: string;
    nameSearch?: string;
    popupTitle?: string;
    popupText?: string;
    filterOptions?: string;
    stripsDigits?: string;
    requiredMsg?: string;
    nameRequiredMsg?: string; // empty Name does not show the standard "Name is required"
    searchSpaces?: string;
    nameMax?: string;         // Name is not limited to the standard 150 characters
  };
};
