const MeetingProposal = require('../models/meetingProposal');
const Event = require('../models/event');
const SchedulingAlgorithm = require('../services/schedulingAlgorithm');

exports.createProposal = async (req, res) => {
  try {
    const { title, description, duration, preferredTimeRanges, participants, externalParticipants, priority } = req.body;
    const initiatorId = req.user.id;

    const newProposal = new MeetingProposal({
      initiatorId,
      title,
      description,
      duration,
      preferredTimeRanges,
      participants,
      externalParticipants,
      status: 'pending',
      priority,
    });

    const savedProposal = await newProposal.save();

    // Fetch busy times for all participants within the preferred time ranges
    const allParticipantIds = [initiatorId, ...participants];
    
    // Find all existing events for the participants that conflict with the preferred time ranges
    const busyTimes = await Event.find({
      userId: { $in: allParticipantIds },
      $or: preferredTimeRanges.map(range => ({
        startTime: { $lt: new Date(range.end) },
        endTime: { $gt: new Date(range.start) },
      })),
    }).select('userId startTime endTime');

    const schedulingAlgo = new SchedulingAlgorithm();
    const suggestedTimes = await schedulingAlgo.calculateOptimalTime(
      busyTimes,
      {
        duration: savedProposal.duration,
        preferredTimeRanges: savedProposal.preferredTimeRanges,
        priority: savedProposal.priority,
      },
      allParticipantIds
    );

    savedProposal.suggestedTimes = suggestedTimes;
    savedProposal.status = 'suggestions_ready'; // 상태를 suggestions_ready로 변경
    await savedProposal.save();

    res.status(201).json(savedProposal);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.getProposals = async (req, res) => {
  try {
    // Get proposals logic
    res.json({ msg: 'List of proposals' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.getProposalById = async (req, res) => {
  try {
    // Get single proposal logic
    res.json({ msg: 'Single proposal' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.suggestTime = async (req, res) => {
  try {
    // Suggest time logic
    res.json({ msg: 'Time suggested' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.finalizeTime = async (req, res) => {
  try {
    const { id: proposalId } = req.params;
    const { finalTime } = req.body;
    const proposal = await MeetingProposal.findById(proposalId);

    if (!proposal) {
      return res.status(404).json({ msg: 'Proposal not found' });
    }

    // Check if the user is the initiator
    if (proposal.initiatorId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    proposal.status = 'finalized';
    proposal.finalizedTime = finalTime;
    await proposal.save();

    // Create a new event based on the finalized proposal
    const newEvent = new Event({
      userId: proposal.initiatorId,
      title: proposal.title,
      description: proposal.description,
      startTime: finalTime,
      endTime: new Date(new Date(finalTime).getTime() + proposal.duration * 60000),
      participants: proposal.participants.map(p => ({ userId: p, status: 'accepted' })),
      externalParticipants: proposal.externalParticipants.map(p => ({ email: p.email, name: p.name, status: 'accepted' })),
      priority: proposal.priority,
      category: 'meeting',
    });

    await newEvent.save();

    res.json(newEvent);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.cancelProposal = async (req, res) => {
  try {
    // Cancel proposal logic
    res.json({ msg: 'Proposal cancelled' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};