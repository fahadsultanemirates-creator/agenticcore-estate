// AgenticCore Estate — list-your-property form

const sellForm = document.getElementById('sellForm');
if (sellForm) {
  const user = requireAuth(['buyer', 'seller', 'developer']);

  sellForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const listing = AcDB.addListing({
      ownerId: user.id,
      title: document.getElementById('sellTitle').value.trim(),
      type: document.querySelector('input[name="sellType"]:checked').value,
      city: document.getElementById('sellCity').value.trim(),
      area: document.getElementById('sellArea').value.trim(),
      price: Number(document.getElementById('sellPrice').value),
      beds: Number(document.getElementById('sellBeds').value) || 0,
      baths: Number(document.getElementById('sellBaths').value) || 0,
      sizeMarla: Number(document.getElementById('sellSize').value) || 0,
      description: document.getElementById('sellDescription').value.trim()
    });

    window.location.href = 'listing.html?id=' + listing.id + '&posted=1';
  });
}
