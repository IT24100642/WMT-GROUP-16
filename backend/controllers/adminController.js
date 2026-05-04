const User = require('../models/User');
const Shift = require('../models/Shift');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const FoodOrder = require('../models/FoodOrder');
const PORTAL_TEAM_SEED = [
  { name: 'Room Manager', username: 'room_manager', email: 'room_manager@hotel.com', password: 'room_manager123', roleName: 'Room Manager' },
  { name: 'Kitchen Manager', username: 'kitchen_manager', email: 'kitchen_manager@hotel.com', password: 'kitchen_manager123', roleName: 'Kitchen Manager' },
  { name: 'Review Manager', username: 'review_manager', email: 'review_manager@hotel.com', password: 'review_manager123', roleName: 'Review Manager' },
  { name: 'Receptionist', username: 'receptionist', email: 'receptionist@hotel.com', password: 'receptionist123', roleName: 'Receptionist' },
  { name: 'Customer Manager', username: 'customer_manager', email: 'customer_manager@hotel.com', password: 'customer_manager123', roleName: 'Customer Manager' },
];

exports.getStaff = async (req, res) => {
  try {
    const staff = await User.find({ role: 'staff' });
    const formatted = staff.map((u) => {
      const user = u.toObject();
      user.role = { name: user.roleName || user.role };
      return user;
    });
    res.status(200).json(formatted);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.createStaff = async (req, res) => {
  try {
    const { name, username, email, password, roleName } = req.body;
    const staff = await User.create({
      name, username, email, password, role: 'staff', roleName
    });
    res.status(201).json(staff);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.deleteStaff = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({});
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.getShifts = async (req, res) => {
  try {
    const shifts = await Shift.find()
      .populate('staff', 'name username role roleName active');

    const formatted = shifts.map((s) => {
      const shift = s.toObject();
      if (shift.staff && typeof shift.staff.role === 'string') {
        shift.staff.role = { name: shift.staff.roleName || shift.staff.role };
      }
      if (!shift.roleName) {
        shift.roleName = shift.staff?.role?.name || shift.staff?.roleName || 'Staff';
      }
      return shift;
    });

    res.status(200).json(formatted);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.createShift = async (req, res) => {
  try {
    const { staff, roleName, startAt, endAt, label, notes } = req.body;
    if (!startAt || !endAt) {
      return res.status(400).json({ error: 'startAt and endAt are required' });
    }
    let staffId = null;
    let resolvedRoleName = String(roleName || '').trim();
    if (staff) {
      const assignee = await User.findById(staff);
      if (!assignee || assignee.role !== 'staff') {
        return res.status(400).json({ error: 'Selected staff member is invalid' });
      }
      staffId = assignee._id;
      if (!resolvedRoleName) {
        resolvedRoleName = assignee.roleName || 'Staff';
      }
    }
    if (!resolvedRoleName) {
      return res.status(400).json({ error: 'roleName is required (or provide staff)' });
    }

    const shift = await Shift.create({ staff: staffId, roleName: resolvedRoleName, startAt, endAt, label, notes });
    const hydrated = await Shift.findById(shift._id).populate('staff', 'name username role roleName active');
    const out = hydrated ? hydrated.toObject() : shift.toObject();
    if (out.staff && typeof out.staff.role === 'string') {
      out.staff.role = { name: out.staff.roleName || out.staff.role };
    }
    if (!out.roleName) {
      out.roleName = resolvedRoleName;
    }
    res.status(201).json(out);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.updateShift = async (req, res) => {
  try {
    const { staff, roleName, startAt, endAt, label, notes } = req.body;
    const updates = {};
    if (staff !== undefined) {
      if (!staff) {
        updates.staff = null;
      } else {
        const assignee = await User.findById(staff);
        if (!assignee || assignee.role !== 'staff') {
          return res.status(400).json({ error: 'Selected staff member is invalid' });
        }
        updates.staff = assignee._id;
        if (roleName === undefined) {
          updates.roleName = assignee.roleName || 'Staff';
        }
      }
    }
    if (roleName !== undefined) updates.roleName = roleName;
    if (startAt !== undefined) updates.startAt = startAt;
    if (endAt !== undefined) updates.endAt = endAt;
    if (label !== undefined) updates.label = label;
    if (notes !== undefined) updates.notes = notes;

    const shift = await Shift.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('staff', 'name username role roleName active');

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    const updatedShift = shift.toObject();
    if (updatedShift.staff && typeof updatedShift.staff.role === 'string') {
      updatedShift.staff.role = { name: updatedShift.staff.roleName || updatedShift.staff.role };
    }
    if (!updatedShift.roleName) {
      updatedShift.roleName = updatedShift.staff?.role?.name || updatedShift.staff?.roleName || 'Staff';
    }

    res.status(200).json(updatedShift);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.deleteShift = async (req, res) => {
  try {
    const deleted = await Shift.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Shift not found' });
    res.status(200).json({});
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getSummaryReports = async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const totalRooms = await Room.countDocuments();
    const revenueObj = await Booking.aggregate([{ $group: { _id: null, total: { $sum: "$totalPrice" } } }]);
    const revenue = revenueObj.length > 0 ? revenueObj[0].total : 0;
    
    res.status(200).json({
      totalBookings,
      totalRooms,
      revenue,
      occupancyRate: '75%', // Mocked for now
    });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.getAdminIssues = async (req, res) => {
  try {
    // Just a mocked empty array for issues
    res.status(200).json([]);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.updateAdminIssue = async (req, res) => {
  try {
    res.status(200).json({ success: true, message: 'Issue updated' });
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

exports.bootstrapPortalStaff = async (req, res) => {
  try {
    const created = [];
    const existing = [];

    for (const member of PORTAL_TEAM_SEED) {
      const found = await User.findOne({ username: member.username });
      if (found) {
        existing.push(member.username);
        continue;
      }
      const user = await User.create({
        name: member.name,
        username: member.username,
        email: member.email,
        password: member.password,
        role: 'staff',
        roleName: member.roleName,
      });
      created.push(user.username);
    }

    res.status(200).json({
      created,
      existing,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
