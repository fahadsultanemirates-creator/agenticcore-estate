/* ============================================
   AgenticCore Estate — property type taxonomy
   ------------------------------------------------
   Matches Zameen.com's real category tree (Residential /
   Plots / Commercial) so filtering actually works the way
   buyers on other Pakistani portals already expect.
   ============================================ */

const AC_PROPERTY_TYPES = [
  { value: 'house', label: 'House', group: 'Residential' },
  { value: 'flat', label: 'Flat / Apartment', group: 'Residential' },
  { value: 'upper_portion', label: 'Upper Portion', group: 'Residential' },
  { value: 'lower_portion', label: 'Lower Portion', group: 'Residential' },
  { value: 'room', label: 'Room', group: 'Residential' },
  { value: 'farm_house', label: 'Farm House', group: 'Residential' },
  { value: 'residential_plot', label: 'Residential Plot', group: 'Plots' },
  { value: 'commercial_plot', label: 'Commercial Plot', group: 'Plots' },
  { value: 'agricultural_land', label: 'Agricultural Land', group: 'Plots' },
  { value: 'office', label: 'Office', group: 'Commercial' },
  { value: 'shop', label: 'Shop', group: 'Commercial' },
  { value: 'warehouse', label: 'Warehouse / Factory', group: 'Commercial' },
  { value: 'building', label: 'Building', group: 'Commercial' }
];

const AC_PROPERTY_GROUPS = ['Residential', 'Plots', 'Commercial'];

function acPropertyTypeLabel(value) {
  const found = AC_PROPERTY_TYPES.find(function (t) { return t.value === value; });
  return found ? found.label : value;
}

function acPropertyTypeOptionsHTML(selectedValue) {
  return AC_PROPERTY_GROUPS.map(function (group) {
    const opts = AC_PROPERTY_TYPES.filter(function (t) { return t.group === group; })
      .map(function (t) {
        return '<option value="' + t.value + '"' + (t.value === selectedValue ? ' selected' : '') + '>' + t.label + '</option>';
      }).join('');
    return '<optgroup label="' + group + '">' + opts + '</optgroup>';
  }).join('');
}
