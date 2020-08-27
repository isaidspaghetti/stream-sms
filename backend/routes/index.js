const express = require('express');
const router = express.Router();
const { StreamChat } = require('stream-chat');
const twilio = require('twilio');

const streamApiKey = process.env.STREAM_API_KEY;
const streamApiSecret = process.env.STREAM_API_SECRET;

const serverSideClient = new StreamChat(
  streamApiKey,
  streamApiSecret
);

router.post('/admin-login', async (req, res) => {
  try {
    const username = req.body.adminId.replace(/\s/g, '_').toLowerCase();
    const token = serverSideClient.createToken(username);

    await serverSideClient.updateUser(
      {
        id: username,
        role: 'admin'
      },
      token
    );

    const channel = serverSideClient.channel('messaging', "livechat", {
      name: "Default Admin Channel",
      created_by: { id: username }
    });

    await channel.create();
    await channel.addMembers([username]);

    res.status(200).json({
      adminName: username,
      token,
      streamApiKey,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/send-reminder', async (req, res) => {
  try {
    const { phoneNumber, messageText } = req.body;
    const accountSid = process.env.TWILIO_SID;
    const authToken = process.env.TWILIO_TOKEN;
    const client = twilio(accountSid, authToken);

    await client.messages
      .create({
        body: messageText,
        from: '+14752566269',
        to: phoneNumber
      });
    res.status(200).json({
      sent: true
    });
  } catch (err) {
    res.status(500).json(err.message);
  }
});

router.post('/receive-sms', async (req, res) => {
  const phoneNumber = req.body.From.replace('+', '');
  const messageText = req.body.Body;

  try {
    const filter = { type: 'sms', members: { $in: [phoneNumber] } };

    const sort = { last_message_at: -1 };

    const existingChannels = await serverSideClient.queryChannels(filter, sort);

    if (existingChannels.length >= 1) {
      let channel = existingChannels.find(c => c.id === phoneNumber);

      await channel.sendMessage({
        text: messageText,
        user: { id: phoneNumber }
      });

    } else {
      const newUser = {
        id: phoneNumber,
        name: 'Patient'
      };

      await serverSideClient.upsertUser(newUser);

      const channel = serverSideClient.channel('sms', phoneNumber, {
        name: `Chat with ${phoneNumber}`,
        created_by: { id: 'admin' },
        members: [newUser.id, 'admin'],
      });

      await channel.create();
      await channel.sendMessage({ text: messageText, user: newUser });
    }
    res.status(200).json();
  }
  catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  };
});

router.post('/stream-outgoing-sms', async (req, res) => {
  if (req.body.type === 'message.new' && req.body.channel_type === 'sms' && req.body.user.role == 'admin') {
    try {
      const accountSid = process.env.TWILIO_SID;
      const authToken = process.env.TWILIO_TOKEN;
      const client = twilio(accountSid, authToken);

      await client.messages
        .create({
          body: req.body.message.text,
          from: '+14752566269',
          to: `${req.body.channel_id}`
        });

      res.status(200);

    } catch (err) {
      res.status(500).json(err.message);
    }
  };
});

// twilio error catcher
router.post('/twilio-error', async (req, res) => {
  try {
    res.status(200).json();
  }
  catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
