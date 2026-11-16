function overflow(total, cap) {
  return Math.max(0, total - cap);
}

async function record(ErrorLog, fields, cap) {
  await ErrorLog.create(fields);
  const extra = overflow(await ErrorLog.countDocuments(), cap);
  if (extra > 0) {
    const oldest = await ErrorLog.find().sort({ createdAt: 1 }).limit(extra).select('_id');
    await ErrorLog.deleteMany({ _id: { $in: oldest.map(function(o) { return o._id; }) } });
  }
}

module.exports = {
  overflow: overflow,
  record: record
};
