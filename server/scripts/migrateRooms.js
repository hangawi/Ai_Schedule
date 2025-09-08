const mongoose = require('mongoose');
const path = require('path');

// Load environment configuration
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import models
const CoordinationRoom = require('../models/coordinationRoom');
const Room = require('../models/room');
const User = require('../models/user');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected for migration');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const migrateRooms = async () => {
  try {
    console.log('🚀 Starting room migration...');
    
    // Get all legacy coordination rooms
    const legacyRooms = await CoordinationRoom.find({})
      .populate('roomMasterId', 'firstName lastName name email')
      .populate('members', 'firstName lastName name email');

    console.log(`📊 Found ${legacyRooms.length} legacy rooms to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const legacyRoom of legacyRooms) {
      try {
        // Check if already migrated
        const existingRoom = await Room.findOne({ 
          $or: [
            { _id: legacyRoom._id },
            { inviteCode: legacyRoom.inviteCode }
          ]
        });

        if (existingRoom) {
          console.log(`⏭️  Skipping room "${legacyRoom.name}" - already exists`);
          skippedCount++;
          continue;
        }

        // Create new Room document
        const newRoom = new Room({
          _id: legacyRoom._id, // Keep same ID for compatibility
          name: legacyRoom.name,
          description: '', // Legacy rooms don't have descriptions
          owner: legacyRoom.roomMasterId._id,
          members: legacyRoom.members.map(member => ({
            user: member._id,
            joinedAt: legacyRoom.createdAt, // Use room creation date as join date
            color: getRandomColor() // Assign random colors
          })),
          inviteCode: legacyRoom.inviteCode,
          maxMembers: legacyRoom.settings?.maxMembers || 10,
          settings: {
            startHour: legacyRoom.settings?.scheduleStart ? 
              parseInt(legacyRoom.settings.scheduleStart.split(':')[0]) : 9,
            endHour: legacyRoom.settings?.scheduleEnd ? 
              parseInt(legacyRoom.settings.scheduleEnd.split(':')[0]) : 18,
            lunchBreak: {
              enabled: true,
              startTime: legacyRoom.settings?.lunchStart || '12:00',
              endTime: legacyRoom.settings?.lunchEnd || '13:00'
            }
          },
          timeSlots: [], // Will be migrated separately if needed
          requests: [], // Will be migrated separately if needed
          createdAt: legacyRoom.createdAt,
          updatedAt: legacyRoom.updatedAt
        });

        await newRoom.save();
        console.log(`✅ Migrated room: "${legacyRoom.name}" (${legacyRoom.inviteCode})`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Failed to migrate room "${legacyRoom.name}":`, error.message);
      }
    }

    console.log(`\n📈 Migration completed:`);
    console.log(`   ✅ Migrated: ${migratedCount} rooms`);
    console.log(`   ⏭️  Skipped: ${skippedCount} rooms`);
    console.log(`   📊 Total processed: ${legacyRooms.length} rooms`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
};

const getRandomColor = () => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

const cleanup = async () => {
  console.log('\n🧹 Starting cleanup of legacy data...');
  
  try {
    const legacyCount = await CoordinationRoom.countDocuments();
    
    if (legacyCount === 0) {
      console.log('✅ No legacy rooms found to cleanup');
      return;
    }

    const confirm = process.argv.includes('--confirm-cleanup');
    if (!confirm) {
      console.log(`⚠️  Found ${legacyCount} legacy rooms.`);
      console.log('⚠️  To remove them, run: npm run migrate:rooms -- --confirm-cleanup');
      return;
    }

    await CoordinationRoom.deleteMany({});
    console.log(`✅ Cleaned up ${legacyCount} legacy coordination rooms`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
};

const main = async () => {
  await connectDB();
  await migrateRooms();
  
  if (process.argv.includes('--cleanup')) {
    await cleanup();
  }
  
  mongoose.disconnect();
  console.log('\n🎉 Migration script completed!');
  process.exit(0);
};

// Handle script errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run the migration
main();