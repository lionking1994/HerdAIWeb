// Add this route to the meeting routes
router.post("/remove_participant", auth, meetingController.removeParticipant);