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

// Pakistani portals measure different property types in different units —
// marla/kanal for houses and residential plots, square feet for flats and
// commercial space, square yards as an alternate for plots. This gives each
// type a sensible default; the unit itself stays a manual dropdown so a
// seller can always override it.
const AC_SIZE_UNITS = [
  { value: 'marla', label: 'Marla' },
  { value: 'kanal', label: 'Kanal' },
  { value: 'sqft', label: 'Sq. Ft.' },
  { value: 'sqyd', label: 'Sq. Yd.' }
];

const AC_DEFAULT_SIZE_UNIT = {
  house: 'marla', farm_house: 'kanal',
  flat: 'sqft', upper_portion: 'sqft', lower_portion: 'sqft', room: 'sqft',
  residential_plot: 'marla', commercial_plot: 'marla', agricultural_land: 'kanal',
  office: 'sqft', shop: 'sqft', warehouse: 'sqft', building: 'sqft'
};

function acSizeUnitLabel(value) {
  const found = AC_SIZE_UNITS.find(function (u) { return u.value === value; });
  return found ? found.label : value;
}

function acSizeUnitOptionsHTML(selectedValue) {
  return AC_SIZE_UNITS.map(function (u) {
    return '<option value="' + u.value + '"' + (u.value === selectedValue ? ' selected' : '') + '>' + u.label + '</option>';
  }).join('');
}

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
