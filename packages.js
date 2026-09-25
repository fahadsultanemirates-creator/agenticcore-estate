/* ============================================
   AgenticCore Estate — shared package definitions
   ------------------------------------------------
   Two independent tracks:
   - AC_SELLER_PACKAGES: Starter/Growth/Elite, for any
     account listing individual properties (profiles.seller_package).
   - AC_DEV_PACKAGES: Launch/Growth/Scale/Business Pool, for
     verified developers listing whole projects (profiles.developer_tier).
   Used to render the membership-card grids on dashboards and
   the public pricing pages.
   ============================================ */

const AC_SELLER_PACKAGES = [
  { tier: 1, name: 'Starter', price: 'Rs 5,000', cap: 5,
    perks: ['Up to 5 active listings', 'Standard search placement', 'Verified-seller badge'] },
  { tier: 2, name: 'Growth', price: 'Rs 15,000', cap: 25,
    perks: ['Up to 25 active listings', 'Priority placement in search', 'Free PDF brochure & banner design, if needed'] },
  { tier: 3, name: 'Elite', price: 'Rs 30,000', cap: null,
    perks: ['Unlimited active listings', 'Top placement + featured badge', '30% discount across AgenticCore family sites'] }
];

const AC_DEV_PACKAGES = [
  { tier: 1, name: 'Launch', price: 'Rs 15,000', cap: 3,
    perks: ['Up to 3 projects', 'Standard project placement', 'Document-verified badge'] },
  { tier: 2, name: 'Growth', price: 'Rs 50,000', cap: 10,
    perks: ['Up to 10 projects', 'Priority placement', 'Social content + brochures, free'] },
  { tier: 3, name: 'Scale', price: 'Rs 200,000', cap: 20,
    perks: ['Up to 20 projects', 'Top placement + featured badge', 'Everything in Growth'] },
  { tier: 4, name: 'Business Pool', price: 'Custom', cap: null,
    perks: ['Unlimited projects', 'Website, brochures, business cards', 'Full marketing partnership'] }
];

const AC_DEV_PACKAGE_NAMES = { 1: 'Launch', 2: 'Growth', 3: 'Scale', 4: 'Business Pool' };
const AC_DEV_PACKAGE_PRICES = { 1: 'Rs 15,000/mo', 2: 'Rs 50,000/mo', 3: 'Rs 200,000/mo', 4: 'Custom' };
const AC_DEV_PACKAGE_CAPS = { 1: 3, 2: 10, 3: 20, 4: null };

const AC_SELLER_PACKAGE_NAMES = { 1: 'Starter', 2: 'Growth', 3: 'Elite' };
const AC_SELLER_PACKAGE_CAPS = { 1: 5, 2: 25, 3: null };

function acTierCardIconColor(tier, maxTier) {
  if (tier === maxTier) return '#F0CE63';
  if (tier === maxTier - 1) return '#D4AF37';
  return '#3FAE7B';
}

// Renders a grid of every package in `list`, marking the one matching
// `activeTier` as active and greying out the rest with an upgrade CTA --
// no real payment flow exists yet, so non-active cards link to `ctaHref`
// rather than claiming a live checkout.
function acPackageGridHTML(list, activeTier, ctaHref) {
  const maxTier = list[list.length - 1].tier;
  return '<div class="tier-table tier-table-4">' + list.map(function (pkg) {
    const isActive = activeTier === pkg.tier;
    const featuredClass = pkg.tier === maxTier - 1 ? ' featured' : '';
    const eliteClass = pkg.tier === maxTier ? ' tier-elite' : '';
    const lockedClass = !isActive ? ' locked' : ' active-tier';
    const color = acTierCardIconColor(pkg.tier, maxTier);
    const priceSuffix = pkg.price === 'Custom' ? '' : '<span class="period">/mo</span>';
    return (
      '<div class="tier-card' + featuredClass + eliteClass + lockedClass + '">' +
        '<div class="tier-card-brand"><span>AgenticCore Estate</span><svg viewBox="0 0 100 100" fill="none"><polygon points="50,8 88,29 88,71 50,92 12,71 12,29" stroke="' + color + '" stroke-width="6"/></svg></div>' +
        (isActive ? '<span class="tier-active-badge">Active</span>' : '') +
        '<span class="tier-name">' + pkg.name + '</span>' +
        '<div class="tier-price">' + pkg.price + priceSuffix + '</div>' +
        '<ul>' + pkg.perks.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul>' +
        (isActive ? '' : '<a href="' + ctaHref + '" class="btn btn-secondary btn-sm" style="margin-top:0.8rem;display:block;text-align:center;">' + (activeTier ? 'Switch package' : 'Choose this package') + '</a>') +
      '</div>'
    );
  }).join('') + '</div>';
}
