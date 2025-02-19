const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// MongoDB connection variables
let client;
let db;

// Function to establish and reuse MongoDB connection
const connectToDatabase = async () => {
  if (client && db) return { client, db };

  const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yw20g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  try {
    // Attempt to connect to the database (does not require isConnected() check)
    // await client.connect();
    db = client.db('scholarshipsDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }

  return { client, db };
};


// Middleware
app.use(express.json());
app.use(cors({
  origin: ['https://rayhan-scholarship.web.app', 'http://localhost:5173'],
}));

// Utility function to format dates
const formatDate = (date) => {
  const options = {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric', // Include seconds
    hour12: true,
  };
  return new Intl.DateTimeFormat('en-US', options).format(date);
};

// Middleware to log requests and responses
const requestLogger = (req, res, next) => {
  const method = req.method;
  const url = req.url;
  const query = JSON.stringify(req.query, null, 2);
  const body = JSON.stringify(req.body, null, 2);
  const params = JSON.stringify(req.params, null, 2);
  const formattedDate = formatDate(new Date());

  console.log('------------------------');
  console.log(`Api :- \x1b[0m\x1b[34m${method}\x1b[0m \x1b[32m${url}\x1b[0m \x1b[36m[${formattedDate}]\x1b[0m`);
  console.log('Query:', query);
  console.log('Params:', params);
  console.log('Body:', body);
  console.log('------------------------');

  next();
};

app.use(requestLogger);

// JWT Token verification middleware
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }

  const token = req.headers.authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }
    req.decoded = decoded;
    next();
  });
};

// Verify if the user is an admin
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const { db } = await connectToDatabase();
  const query = { email };
  const user = await db.collection('users').findOne(query);
  const isAdmin = user?.role === 'admin';
  if (!isAdmin) {
    return res.status(403).send({ message: 'Forbidden access' });
  }
  next();
};

// API to get JWT token
app.post('/jwt', async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1hr' });
  res.send({ token });
});

// Users related APIs
app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
  const { db } = await connectToDatabase();
  const result = await db.collection('users').find().toArray();
  res.send(result);
});

app.get('/users/admin/:email', verifyToken, async (req, res) => {
  const email = req.params.email;

  if (email !== req.decoded.email) {
    return res.status(403).send({ message: 'Unauthorized access' });
  }

  const { db } = await connectToDatabase();
  const query = { email };
  const user = await db.collection('users').findOne(query);
  let admin = false;
  if (user) {
    admin = user?.role === 'admin';
  }
  res.send({ admin });
});

app.get('/users/moderator/:email', verifyToken, async (req, res) => {
  const email = req.params.email;

  if (email !== req.decoded.email) {
    return res.status(403).send({ message: 'Unauthorized access' });
  }

  const { db } = await connectToDatabase();
  const query = { email };
  const user = await db.collection('users').findOne(query);
  let moderator = false;
  if (user) {
    moderator = user?.role === 'moderator';
  }
  res.send({ moderator });
});

app.post('/users', async (req, res) => {
  const user = req.body;
  const { db } = await connectToDatabase();
  const existingUser = await db.collection('users').findOne({ email: user.email });
  if (existingUser) {
    return res.send({ message: 'User already exists' });
  }
  const result = await db.collection('users').insertOne(user);
  res.send(result);
});

app.patch('/users/admin/:id', async (req, res) => {
  const id = req.params.id;
  const role = req.query.role;
  const { db } = await connectToDatabase();
  const result = await db.collection('users').updateOne(
    { _id: new ObjectId(id) },
    { $set: { role: role } }
  );
  res.send(result);
});

app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const { db } = await connectToDatabase();
  const result = await db.collection('users').deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

// Scholarships related APIs
app.get('/scholarships', async (req, res) => {
  const { db } = await connectToDatabase();
  const result = await db.collection('scholarships').find().toArray();
  res.send(result);
});

app.get('/scholarships/:id', async (req, res) => {
  const id = req.params.id;
  const { db } = await connectToDatabase();
  const result = await db.collection('scholarships').findOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.post('/scholarships', async (req, res) => {
  const scholarship = req.body;
  const { db } = await connectToDatabase();
  const result = await db.collection('scholarships').insertOne(scholarship);
  res.send(result);
});

app.patch('/scholarships/:id', async (req, res) => {
  const item = req.body;
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) };
  const updatedDoc = {
    $set: {
      university_logo: item.university_name,
      scholarship_category: item.university_logo,
      university_location: item.university_location,
      application_deadline: item.application_deadline,
      subject_name: item.subject_name,
      scholarship_description: item.scholarship_description,
      post_date: item.post_date,
      service_charge: item.service_charge,
      application_fees: item.application_fees,
      university_name: item.university_name,
    }
  };
  const { db } = await connectToDatabase();
  const result = await db.collection('scholarships').updateOne(filter, updatedDoc);
  res.send(result);
});

app.delete('/scholarships/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(400).json({ message: "Invalid ObjectId format." });
  }
  const { db } = await connectToDatabase();
  const result = await db.collection('scholarships').deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

// Apply Scholarships related APIs
app.get('/applyScholarship', async(req, res) => {
  const { db } = await connectToDatabase();
  const result = await db.collection('applyScholarships').find().toArray();
  res.send(result)
})

app.get('/applyScholarship', async (req, res) => {
  const email = req.query.email;
  const { db } = await connectToDatabase();
  const query = {userEmail: email}
  const result = await db.collection('applyScholarships').find(query).toArray();
  res.send(result);
});

app.post('/applyScholarships', async (req, res) => {
  const apply = req.body;
  const { db } = await connectToDatabase();
  const result = await db.collection('applyScholarships').insertOne(apply);
  res.send(result);
});

app.patch('/applyScholarships/feedback/:id', async (req, res) => {
  const  id  = req.params;
  const { db } = await connectToDatabase();
  const result = await db.collection('applyScholarships').updateOne(
    {_id: new ObjectId(id)},
    {$set: {status: 'success'}}
  )
  res.send(result)
});


app.delete('/applyScholarships/:id', async (req, res) => {
  const id = req.params.id;
  const { db } = await connectToDatabase();
  const result = await db.collection('applyScholarships').deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

// Reviews related APIs
app.get('/reviews', async (req, res) => {
  const { db } = await connectToDatabase();
  const result = await db.collection('reviews').find().toArray();
  res.send(result);
});

app.get('/reviews/myReviews', async (req, res) => {
  const email = req.query.email;
  const { db } = await connectToDatabase();
  const query = { userEmail: email };
  const result = await db.collection('reviews').find(query).toArray();
  res.send(result);
});

app.delete('/reviews/:id', async (req, res) => {
  const id = req.params.id;
  const { db } = await connectToDatabase();
  const result = await db.collection('reviews').deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.post('/reviews', async (req, res) => {
  const reviews = req.body;
  const { db } = await connectToDatabase();
  const result = await db.collection('reviews').insertOne(reviews);
  res.send(result);
});



// payment intent
app.post('/create-payment-intent', async (req, res) => {
  const { price } = req.body;
  const amount = parseInt(price * 100);
  console.log(amount, 'amount intent')

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: 'usd',
    payment_method_types: ['card']
  });


  // ------------------------------------------------

  res.send({
    clientSecret: paymentIntent.client_secret
  })
})

// Test the server
app.get('/', (req, res) => {
  res.send('Server is running');
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
