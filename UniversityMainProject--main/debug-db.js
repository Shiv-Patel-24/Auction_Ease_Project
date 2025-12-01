// debug-db.js (node script)
const mongoose = require('mongoose');
const Listing = require('./models/listing');
const Order = require('./models/order');
const User = require('./models/user');

async function inspect() {
  await mongoose.connect('mongodb://127.0.0.1:27017/finalproject');
  const me = await User.findOne().limit(1).lean();
  console.log('SAMPLE USER:', me ? { id: me._id, email: me.email, name: me.name } : 'NO_USER');

  const listings = await Listing.find({}).limit(5).lean();
  console.log('SAMPLE LISTINGS (first 5):');
  listings.forEach(l => console.log(JSON.stringify({ id: l._id, title: l.title, owner: l.owner ?? l.author ?? l.user ?? null, keys: Object.keys(l).slice(0,12) }, null, 2)));

  const orders = await Order.find({}).limit(5).lean();
  console.log('SAMPLE ORDERS (first 5):');
  orders.forEach(o => console.log(JSON.stringify({
    id: o._id,
    buyer: o.buyer ?? o.user ?? o.customer ?? null,
    hasItemsArray: Array.isArray(o.items),
    topKeys: Object.keys(o).slice(0,12)
  }, null, 2)));
  await mongoose.disconnect();
}
inspect().catch(e => { console.error(e); process.exit(1); });
