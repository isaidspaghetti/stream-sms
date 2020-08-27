# Send SMS Appointment Reminders + Send and Receive SMS Texts In A Chat App 

> **This powerful Chat Dashboard allows healthcare administrators to send SMS appointment reminders to patients, and opens a new a chat when patients reply to reminders (SMS-to-App).**

![](images/gif.gif) 

## Background

This tutorial will guide you through a no-nonsense, easy-to-build chat app that can send and receive SMS text messages, and send SMS appointment reminders. It has a side panel showing all active chats (a-la iMessage). It also allows for app-to-app messaging and it can serve as a jumping-off point for your fully customized admin dashboard. 

We'll be using [Stream](https://getstream.io/), [Twilio](https://twilio.com), and [ngrok](https://ngrok.com/) for this example. Stream will power all the chat infrastructure, Twilio provides telephony for our SMS messages, and ngrok provides a publically available URL for Stream's wehbooks. This app is built with [Node.js](https://nodejs.org/en/) and [React](https://reactjs.org), but the methodologies can be easily ported to most languages and frameworks.

Oh wurd? You want that git? [Repo here](https://github.com/isaidspaghetti/stream-sms-reminder)!

### What is Stream Chat?

>*Build real-time chat in less time. Connect patients with administrators and doctors with [HIPAA Compliant](https://getstream.io/blog/hipaa-chat/) Stream Chat messaging platform API & SDKs. Rapidly ship in-app messaging with a reliable, scalable chat infrastructure.*
>- [Stream Chat & Messaging](https://getstream.io/chat/)

## Prerequisites

- Basic knowledge of [React Hooks](https://reactjs.org/docs/hooks-intro.html) and [Express](https://expressjs.com/en/api.html). 
- [Node.js](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [React](https://reactjs.org/docs/getting-started.html)
- A (free) [Stream](https://getstream.io/dashboard/) Trial Account
- A (free) [Twilio](https://www.twilio.com/try-twilio) Trial Account
- A (free) [ngrok](https://dashboard.ngrok.com/get-started/setup) Account

## Outline
- Build the admin dashboard
>- Set up Stream account
>- Admin login form
>- Login endpoint
>- Render dashboard
- Send Appointment Reminders
>- Admin SMS Reminder form
>- Set up Twilio account
>- Reminder endpoint
- Receive SMS messages
>- Setup ngrok
>- Send a Twilio webhook
>- Receive a Twilio webhook
- Send SMS messages
>- Send a Stream webhook
>- Receive a Stream webhook
>- Send SMS via Twilio

## Frontend UI

>This app is split into `frontend` and `backend` folders which will use [Stream's React Components](https://github.com/GetStream/stream-chat-react) and [JavaScript Libraries](https://github.com/GetStream/stream-js), respectively. Once everything is set up, you can run the app using `npm install` & `nodemon` on both the `backend` and `frontend` folders. So let's get your Stream account set up first.

### Stream Configuration

Sign up for your [free Stream trial](https://getstream.io/). Then get to the dashboard to create a new Stream app and grab an API Key and Secret.

1. You can get to the dashboard from this button

![](images/stream-dashboard-button.png)

2. From the dashboard, hit that 'Create App' button

![](images/stream-app-button.png)

3. Give your app a name and select 'Development' mode

![](images/create-new-app.png)

4. This will generate an API key and Secret which we'll add to a `.env` file.

![](images/stream-key-secret.png)

### `.env` Configuration

The [Git Repo](https://github.com/isaidspaghetti/stream-sms-reminder) contains a file in `backend` titled `.env.example`. Add your Stream API Key and Stream Secret here, then rename the file to `.env`. 

<!-- https://gist.github.com/isaidspaghetti/9315e828416e077cd46b069b60703afd -->
```bash
//backend/.env.example:1
NODE_ENV=development
PORT=8080

STREAM_API_KEY= your Stream API key here
STREAM_API_SECRET= your Stream API secret here
```

### Login Form

The login page has a simple React form that uses a state variable for the input. 

![](images/login-form.png)

You'll obviously want to add some security checks like a password for a production app, but that's out of our scope in this post. Here's the code for the form:

<!-- https://gist.github.com/isaidspaghetti/f2f22240ad91804fc670030cd7649d9f -->
```jsx
//frontend/src/Admin.js:127
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
```

When submitted, the form above triggers the `register` function shown in the next snippet. The `register` function makes a simple `HTTP` `POST` to our backend. (The  `// ...` in the snippet is the part of that function that handles the response from the `backend`. We'll get to that in a minute.)

<!-- https://gist.github.com/isaidspaghetti/aaacfd3ca10ab707613a57566e884633 -->
```jsx
//backend/src/Admin.js:24
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

    // ... Receive the response

  } catch (e) {
    console.error(e);
  }
};
```

Let's look at how we use this information in the `backend`.

## Backend Setup

Before we log our admin in to our app, we need to first verify our Stream Client from our `backend`. We'll use our `streamApiKey` and `streamApiSecret` to do so.

<!-- https://gist.github.com/isaidspaghetti/0a79ef5a1169e9db232ae31502ff55ce -->
```javascript
//backend/routes/index.js:5
const streamApiKey = process.env.STREAM_API_KEY;
const streamApiSecret = process.env.STREAM_API_SECRET;

const serverSideClient = new StreamChat(
  streamApiKey,
  streamApiSecret
);
```

>**Good to know:**
Stream takes care of all of the complex chat infrastructure for us. Every time we use a `serverSideClient` method, that's Stream doing its magic. 🎩

### Login Endpoint

Now we're ready to login our administrator. The `/admin-login` endpoint receives the `frontend` form data and sets up the rest of the Stream chat. 

- Each Stream user needs a token. Use `createToken()` to generate a Stream token.
- To add [users](https://getstream.io/chat/docs/init_and_users/?language=js) to the client from a `backend`, use `updateUser()`
- [Channels](https://getstream.io/chat/docs/?language=js) represent each chat. (We'll create a default channel of the `'messaging'` type)
- We'll send our `frontend` a registered `username`, `token`, and `streamApiKey`.

<!-- https://gist.github.com/isaidspaghetti/09da8edff07558206b5c444179a2c50d -->
```javascript
//backend/routes/index.js:13
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
```

Now let's deal with the response in the `frontend`.

## Start A Frontend Stream Chat

The `frontend`'s `register` function, can now receive the `backend` `response` so it can start a Stream chat in the browser. Here's the `register` function in its entirety.

<!-- https://gist.github.com/isaidspaghetti/2bb83fee9d2c7f512fd9055991143b9d -->
```jsx
//frontend/src/Admin.js:24
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
```

We destructure the `response`, establish a `frontend` instance of Stream (`chatClient`), and configure our user with `setUser`. Your `frontend` Stream chat is ready to render. Let's see why we set the state variable, `setLoggedIn` to `true`.

### Frontend Chat Window

Here's the `jsx` that renders our app. Notice how we use `loggedIn` to determine whether to render a login form or a `<Chat />` component. Each of the components below is provided by Stream. (`Chat`, `ChannelList`, `Channel`, `Window`, `MessageList`, and `MessageInput`). Read up on Stream components [here](https://getstream.github.io/stream-chat-react/).

<!-- https://gist.github.com/isaidspaghetti/9fcab9b62c228255c8dbe6bfed31d65e -->
```html
//frontend/src/Admin.js:84
if (loggedIn) {
    return (
      <Chat client={chatClient} theme={"commerce light"}>
        <ChannelList
          sort={{ last_message_at: -1 }}
          Preview={ChannelPreviewMessenger}
        />
        <Channel>
          <Window>
            // ... SMS Alert form goes here
            <MessageList />
            <MessageInput focus />
          </Window>
          <Thread />
        </Channel>
      </Chat >
    );
  } else {
    return (
      // ...Login Form
    );
  }
}
```

Here is the basic Stream chat we just rendered: 

![](images/dashboard-no-header.png)

Congrats! You've got a simple Stream chat up and running! 👏 Now, let's make it a `spice meatball` with the SMS reminders.

![](images/spice-meatball.png)

## SMS Appointment Reminders

First thing's first: we need another awesome React form. Let's put it into our `frontend` `<Window />`.

<!-- https://gist.github.com/isaidspaghetti/1a37991c0b842c065e2b3f2ba3592586 -->
```html
//frontend/src/Admin.js:84
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
} 
```
Notice that the form of our phone number needs to include `+` and a [country code](https://countrycode.org/).

Next, add a new state variable with a generic default message:

<!-- https://gist.github.com/isaidspaghetti/359d19a780d144d878be033868836761 -->
```jsx
//frontend/src/Admin.js:22
const [messageText, setMessageText] = useState('Your appointment is coming up soon! Respond here to chat with a customer representative');
```

The new code above adds a slick header to our chat:

![](images/header.png)

Awesome. Now let's look at the `sendReminder` function this form triggers.

<!-- https://gist.github.com/isaidspaghetti/9fab38f494fcb388a23156a268b3bb6c -->
```jsx
//frontend/src/Admin.js:57
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
  ```

The function makes a `POST` request to the `backend` with a `body` that includes a `phoneNumber` (message recipient), and a `message` to send. Then, if the `backend` is successful (`if(sent)`) we change our form input to indicate the message was sent, and set our message back to the default.

There are plenty of ways to indicate a successful send, but just changing the `phoneNumber` state keeps our tutorial nicely scoped.

### Reminder Endpoint

OK, so we have sent our reminder to the `backend`. How do we send it from there to a phone?

The endpoint for sending reminders is shown below. The `body` is the SMS text that will get sent to your phone. 
Notice what we will need to establish a Twilio phone number, `client`, `SID`, and `TOKEN` for this to work. We'll set that up next.

<!-- https://gist.github.com/isaidspaghetti/f08060c8d0be30b1948d80803acb5ee2 -->
```javascript
//backend/routes/index.js:46
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
```

### Why Twilio?

SMS messaging requires [telephony](https://en.wikipedia.org/wiki/Telephony) services, so we need an API to help us with that. We'll use [Twilio](https://www.twilio.com/) for this example, but you can easily modify this code to use [other telephony services](https://getvoip.com/blog/2020/03/16/top-twilio-alternatives/). 

The following sections will show (1) how easy it is to integrate other API's using Stream, and (2) how easy it is to build exactly what you're looking for in a Healthcare Chat with Stream. Check out [this post](https://getstream.io/blog/stream-chat-vs-twilio-chat/) for more details on Stream vs. Twilio.



### Twilio Configuration

1. Sign up for a Twilio Trial [here](https://www.twilio.com/try-twilio). 

2. From the [Twilio Console](https://www.twilio.com/console), grab a Twilio phone number

![](images/twilio-get-number.png)

3. Copy and paste the Twilio SID and Auth Token, then add them to your `.env`

![](images/twilio-auth.png)

<!-- https://gist.github.com/isaidspaghetti/de86ce01cebbeab0ca43919a5359b97a -->
```bash
//backend/.env:1
NODE_ENV=development
PORT=8080

STREAM_API_KEY= your Stream API key here
STREAM_API_SECRET= your Stream API secret here
TWILIO_SID= your Twilio SID here
TWILIO_TOKEN= your Twilio Token here
```

4. From the Twilio dashboard select `verified numbers` ([link](https://www.twilio.com/console/phone-numbers/verified)), then add a number where you can send and receive text messages.

![](images/twilio-verify.png)

![](images)

5. Paste these values to the code snippet above and you're good to go!

![](images/text-receive.png)

Cool.

## Receive SMS Replies

>"Can this meatball get spicier?"

>"Yes. Twice as spicy."

>"How?"

>"SMS to Chat."

![](images/double-spice.png)

## SMS Replies

Now, we need to let our phone-user reply to our alert via text. We'll achieve this with the power of webhooks ✨. 

We'll be configuring Twilio to `POST` their webhooks to a URL called `/receive-sms` in our `backend`.

>"But how can Twilio find our URL if we're on `localhost`?"

>"[ngrok](https://ngrok.com/), baby!"

### ngrok

`ngrok` is an awesome service that securely ports your `localhost` to a public URL that Twilio can reach. [Get an ngrok account](https://dashboard.ngrok.com/signup) and follow the [install instructions](https://dashboard.ngrok.com/get-started/setup). You can learn more about `ngrok` in [this post](https://getstream.io/blog/send-chat-transcripts-to-hubspot/).

Once you have `ngrok` installed, run the following in the terminal: 

>`ngrok http 8080`

`ngrok` will now create a random URL to host your `backend` (the `backend` is set to run on port `8080`). Copy and paste the URL shown in the terminal.

![](images/ngrok.png)

### Add A Webhook to Twilio Console

Back in your [Twilio console](https://www.twilio.com/console), click the ellipses logo.

![](images/twilio-ellipses.png)

Select `Phone Numbers` in the Twilio sidebar.

![](images/twilio-sidebar.png)

Click on your Twilio number you created.

![](images/twilio-number.png)

Scroll down to 'Messages', then add the `ngrok` URL you copied + `/receive-sms` in the webhook address bar. You can also add an endpoint to receive any error notifications; just remember you will have to add the endpoint in your `backend` to handle them.

![](images/twilio-webhook.png)

Twilio will now be hooking into your `backend` whenever your Twilio phone number receives a text. Keep in mind that, unless you have a paid `ngrok` account, anytime you restart `ngrok` you will have to add the new URL in the Twilio console.

Now let's deal with that Twilio webhook...

### Create A New Channel

Let's build the `/receive-sms` endpoint to create a new channel when it receives a SMS. (We'll add detection for an existing channel later).

<!-- https://gist.github.com/isaidspaghetti/5d1c181eb7460c1c18ff365f698ec663 -->
```javascript
//backend/routes/index.js:67
router.post('/receive-sms', async (req, res) => {
  const phoneNumber = req.body.From.replace('+', '');
  const messageText = req.body.Body;

  try {
   // ... 
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
      await channel.sendMessage({ text: messageText });
    }
    res.status(200).json();
  }
  catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  };
});
```

We're going to use the sender's `phoneNumber` for a Stream channel name and user id. Channel names don't accept symbols, so the first line removes the `+` from that string. 

Next, we create a user, then `upsertUser` to our `serverSideClient`. A `channel` is created with `type: 'sms'` and `members: [newUser, 'admin']`.

Finally, the `sendMessage()` accepts a `message` object and adds its `text` as a message in the `channel`. 

The new `channel` shows up in the Dashboard `ChannelList`, and the `admin` can reply.

> 🐳 Sweet! But wait--what's that `chat type`?!

### Stream Chat Types

You can create custom Stream [chat types](https://getstream.io/chat/docs/webhooks/?language=js) to systematically change how your app will behave based on what type of chat is occurring. In this case, we're going to create a custom type called `'sms'` so that we can be sure we are only trying to send text messages for app-to-phone channels, rather than app-to-app channels. 

This will allow you to use this Stream app for all your admin chat types, not just SMS conversations. 

### *Want to add App-to-App Chat now?* 
>*We're only adding an admin app dashboard in this post. For help with adding a customer chat dashboard see [this post](https://getstream.io/blog/how-to-capture-leads-from-live-chat-in-hubspot/).*

### Create a Custom Stream Channel

To create a custom channel: 

1. Navigate to [getstream.io](https://getstream.io/) and click the "Dashboard" button on the upper right:

    ![](images/stream-dashboard-button.png)

2. Once in the dashboard, click your app name:

    ![](images/stream-dashboard-app.png)

3. Next, from the navbar select the `chat` dropdown and select `Chat Overview`

    ![](images/stream-app-type.png)

4. In the `Chat Types` box, click `Add Chat Type`

    ![](images/stream-types.png)

5. Name your new type `sms` and click `Save`

    ![](images/stream-chat-type-sms.png)

### Add SMS Messages to Existing Channels

What if your text recipient already started a chat? In this case, we don't want to create a new channel for every message, we just want to add the message to their existing channel. This is why we saved the `phoneNumber` as a `user.id` when we created a channel for the initial SMS response. 

So, let's use Stream's [`client.queryChannels()` method](https://getstream.io/chat/docs/query_channels/?language=js) to look for any channels with `type: sms`, and with a user with `user.id` matching `phoneNumber`.  

`querychannels()` accepts a `filter`, a `sort`, and an optional argument. So let's filter our channels by `type: 'sms'`, and specify that only channels with the `member` with `user.id` `phoneNumber` are returned.

If the array of channels returned is `>=1`, that means this `phoneNumber` already has a channel. So, we extract that channel from the array, create the `message` object, and add it to the channel.

<!-- https://gist.github.com/isaidspaghetti/6b78751a2f08886ee981000e6fa2af88 -->
```javascript
//backend/routes/index.js:67
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
      // ... create a new channel
    }
    res.status(200).json();
  }
  catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  };
});
```

Our app can now receive texts from new and existing phone numbers! 🙌🏼

## Send SMS Messages from Stream

Now, we need a way for Stream to send SMS messages, not just reminders. We'll do this using a Stream webhook.

### Configure Stream for a Webhook

Here's how to register your `ngrok` (or other public URL) with the Stream API:

1. Navigate to [getstream.io](https://getstream.io/) and click the "Dashboard" button on the upper right:

    ![](images/stream-dashboard-button.png)

2. Once in the dashboard, click your app name:

    ![](images/stream-dashboard-app.png)

3. Next, from the navbar select the `chat` dropdown and select `Chat Overview`

    ![](images/stream-app-type.png)

4. Scroll down to the 'Chat Events' box. Select the following options: `Webhook: active`, `Disable Auth Checks`, and `Disable Permissions Checks`. (Note that these options are important to consider using if using this app in a production environment). We'll create a `/stream-outgoing-sms` handler in our `backend`, so just add your public `ngrok` URL + `/stream-outgoing-sms` as the webhook URL. Save your settings.

    ![](images/stream-app-webhooks.png)

The Stream API will now send a `POST` to that URL anytime an event takes place in your Stream App, with details about the event. The next step is to accept that webhook in our app's `backend`.

### Last Step! Stream Webhook Handler

OK, Stream knows to where to send the webhook. Now here's our Stream webhook handler in the `backend`:

<!-- https://gist.github.com/isaidspaghetti/a21dba4d39933ea0d3a7184ad08cee3d -->
```javascript
//backend/routes/index.js:112
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
          to: `+${req.body.channel_id}`
        });

      res.status(200);

    } catch (err) {
      res.status(500).json(err.message);
    }
  };
});
```

Let's dissect that. 🥼 We need to filter out what type of events our webhook will act on, so a boolean checks for  `message.new` events, within the `channel_type : 'sms'`, where the sender is `user` with `role : 'admin'`. Learn more about roles [here](https://getstream.io/chat/docs/update_users/?language=js).

Next, we invoke our Twilio `client` and `create` a message object using the webhook's message text (`req.body.message.text`). Then we send `from` our Twilio phone number and send `to` the phone number that matches the Stream `channel_id`. 

>Notice the pattern of using Stream's `client` info like `channel_id` and `user.id`. These objects allow us to easily transmit and consume data in our apps.

You did it! 👏 You have created an app that can successfully send and receive SMS text messages, as well as app-to-app messages. 

## Review

Healthcare Sector Developers have a plethora of options when it comes to chat tools for their administrators. Narrow down your chat app options to those with SMS-to-app messaging and you've still got a lot to sort through. 

Stream offers a novel approach: an affordable and easy-to-use chat and live feed infrastructure with a robust API integration that you can tailor to perfectly fit your needs. Hopefully, this post goes to show how easily and quickly you can create apps with advanced functionality using Stream. 

>**Reminder: With Stream, you can easily add HIPAA compliance and encryption to any of your apps. [Learn more here](https://getstream.io/blog/hipaa-chat/).**

Check out the [Stream Blog](https://getstream.io/blog/) and [Stream Chat React Docs](https://getstream.github.io/stream-chat-react/) for more inspiration and guidance for your projects. 