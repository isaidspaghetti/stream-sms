import React, { useState } from 'react';
import { StreamChat } from 'stream-chat';
import 'stream-chat-react/dist/css/index.css';
import {
  Chat,
  Channel,
  Window,
  MessageList,
  ChannelList,
  MessageInput,
  ChannelPreviewMessenger,
  Thread
} from "stream-chat-react";

let chatClient;

function Admin() {
  document.title = "Admin";
  const [adminId, setAdminId] = useState('');
  const [loggedIn, setLoggedIn] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [messageText, setMessageText] = useState('Your appointment is coming up soon! Respond here to chat with a customer representative');

  const register = async (e) => {
    try {
      e.preventDefault();
      const response = await fetch('http://localhost:8080/admin-login', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId,
        }),
      });

      const { token, streamApiKey, adminName } = await response.json();

      chatClient = new StreamChat(streamApiKey);

      await chatClient.setUser(
        {
          id: adminName,
          name: 'Clinic Administrator'
        },
        token,
      );

      setLoggedIn(true);

    } catch (e) {
      console.error(e);
    }
  };

  const sendReminder = async (e) => {
    e.preventDefault();
    try {
      e.preventDefault();
      const response = await fetch('http://localhost:8080/send-reminder', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          messageText
        }),
      });
      const { sent } = await response.json();

      if (sent) {
        setPhoneNumber('MESSAGE SENT!');
        setMessageText('Your appointment is coming up soon! Respond here to chat with a customer representative');
      }

    } catch (e) {
      console.error(e);
    }
  };

  if (loggedIn) {
    return (
      <Chat client={chatClient} theme={"commerce light"}>
        <ChannelList
          sort={{ last_message_at: -1 }}
          Preview={ChannelPreviewMessenger}
        />
        <Channel>
          <Window>
            <h2 className="header-title">Healthcare Admin Chat Dashboard</h2>
            <h4 className="header-subtitle">Send SMS Appointment Reminder</h4>
            <form className="stream-header" onSubmit={sendReminder}>
              <label>Phone</label>
              <input
                className="header-input"
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="# with country code IE: +15558675309"
                required
              />
              <label>Msg Text</label>
              <input
                className="header-input"
                type="text"
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                }}
                placeholder="Message"
                required
              />
              <button type="submit">Send SMS</button>
            </form>
            <MessageList />
            <MessageInput focus />
          </Window>
          <Thread />
        </Channel>
      </Chat >
    );
  } else {
    return (
      <div className="App container">
        <form className="card" onSubmit={register}>
          <label>Admin Id</label>
          <input
            type="text"
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
            placeholder="Enter your admin ID"
            required
          />
          <button type="submit">
            Start chat
          </button>
        </form>
      </div>
    );
  }
}

export default Admin;
