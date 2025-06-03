const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const { MongoClient } = require('mongodb');
const app = express();
const PORT = 3000;
//Session
const session = require("express-session");

app.use(session({
  secret: "gadgetgalaxysecret",
  resave: false,
  saveUninitialized: true,
}));


// Connect to MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/Project", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("Connected to MongoDB"));

// Define User Schema
const userSchema = new mongoose.Schema({
  loginId: String,
  password: String,
});
const User = mongoose.model("Useraccounts", userSchema);

//contact//////////////////////
const contactSchema = new mongoose.Schema({
  FirstName: String,
  LastName: String,
  Email: String,
  PhoneNumber: Number,
  Comment: String,
});
const Contacts = mongoose.model("Contacts", contactSchema);
///////////////////////////////


// Define customer Schema
// Define customer Schema
const customerSchema = new mongoose.Schema({
  name: String,
  phone: String,
  address: String,
  orders: [
    {
      products: [
        {
          productName: String,
          price: Number,
          image: String,
        }
      ],
      orderedAt: {
        type: Date,
        default: Date.now,
      }
    }
  ]
});


const customer = mongoose.model("Customer", customerSchema);


// Define Products Schema
// Define Products Schema
const productsSchema = new mongoose.Schema({
  productName: String,
  price: Number,
});
const Product = mongoose.model('Products', productsSchema);

// Handle adding a product


// Middleware


app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set('views',path.join(__dirname,'public'));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());


app.get("/", (req, res) => {
  res.render("index", { message: null });
});
//////////////////////////////////////////////////////////////////////////////
app.post("/login", async (req, res) => {
    const { loginId, password } = req.body;
    const user = await User.findOne({ loginId, password });
  
    if (user) {
      if (loginId === "admin") {
        const customerData = await customer.find();
        res.render("admin", { customers: customerData });
        
      } else {
        // If a student logs in, show the student lookup page
        res.render("main", { loginId, customer: null, products: null, message: null });
      }
      
    } else {
      res.render("index", { message: "Invalid login credentials!" });
    }
  });



//register
app.post("/register", async (req, res) => {
  const { loginId, password } = req.body;
  const existingUser = await User.findOne({ loginId });

  if (existingUser) {
    return res.render("index", { message: "User already exists!" });
  }

  const newUser = new User({ loginId, password });
  await newUser.save();
  res.render("index", { message: "Registration successful!" });
});
//logOut
app.get("/logout", (req, res) => {
  res.render("index", { message: "You have been logged out!" });
});


//sessions html pages
app.get("/mobiles", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "mobiles.html"));
});

app.get("/laptops", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "laptops.html"));
});

app.get("/speakers", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "speakers.html"));
});


/////////////
app.get("/home", (req, res) => {
  res.render("main");
});

////////////
app.get("/contact", (req, res) => {
  res.render("contactus");
});

app.post('/contact', async (req, res) => {
  const { FirstName,LastName,Email,PhoneNumber,Comment } = req.body;
  try {
      const newContact = new Contacts({
          FirstName: req.body.FirstName,
          LastName: req.body.LastName,
          Email: req.body.Email,
          PhoneNumber: parseInt(req.body.PhoneNumber, 10),
          Comment: req.body.Comment,
      });

      await newContact.save();
      res.render("contactus");
      
  } catch (error) {
      console.error("Error inserting contacts:", error);
      res.status(500).send("Failed to add Contact: " + error.message);
  }
});

////add to cart
app.post("/add-to-cart", (req, res) => {
  const { productName, price, image } = req.body;

  if (!req.session.cart) {
    req.session.cart = [];
  }

  req.session.cart.push({ productName, price, image });
  res.redirect("/cart"); // Go to cart after adding
  
});
///////////

app.get("/cart", (req, res) => {
  const cart = req.session.cart || [];
  res.render("cart", { cart });
});



//delete an product
app.post("/remove-from-cart", (req, res) => {
  const indexToRemove = parseInt(req.body.index);
  if (!isNaN(indexToRemove) && req.session.cart && req.session.cart.length > indexToRemove) {
    req.session.cart.splice(indexToRemove, 1); // remove item by index
  }
  res.redirect("/cart"); // Go back to cart after removing
});
//

app.post("/submit-order", async (req, res) => {
  const { username, phone, address } = req.body;
  const cart = req.session.cart || [];

  try {
    if (cart.length === 0) {
      return res.render("cart", { cart, message: "Cart is empty!" });
    }

    let existingCustomer = await customer.findOne({ name: username });

    if (existingCustomer) {
      //  Add the new order to existing customer
      existingCustomer.orders.push({ products: cart });
      await existingCustomer.save();
    } else {
      //  Create new customer with the order
      const newCustomer = new customer({
        name: username,
        phone,
        address,
        orders: [{ products: cart }],
      });
      await newCustomer.save();
    }

    req.session.cart = []; // Clear cart after order
    res.render("cart", { cart: [], message: "Order placed successfully!" });
  } catch (error) {
    console.error("Order submission error:", error);
    res.status(500).send("Something went wrong.");
  }
});




//previous Orders
app.post("/orders", async (req, res) => {
  const { username } = req.body;

  try {
    const user = await customer.findOne({ name: username });

    if (!user || user.orders.length === 0) {
      return res.render("orders", { orders: null, message: "No orders found for this user." });
    }

    res.render("orders", { orders: user.orders, message: null });
  } catch (error) {
    console.error("Order fetch error:", error);
    res.status(500).send("Something went wrong.");
  }
});


////
app.get("/admin/useraccounts", async (req, res) => {
  try {
    const users = await db.collection("useraccounts").find().toArray();
    res.render("public/admin", { users }); // assumes your file is admin.ejs
  } catch (error) {
    console.error("Error fetching user accounts:", error);
    res.render("admin", { users: [] });
  }
});
////
app.get('/admin/data/:collection', async (req, res) => {
  const collectionName = req.params.collection;
  const allowedCollections = ['useraccounts', 'contacts', 'customers','products'];

  if (!allowedCollections.includes(collectionName)) {
    return res.status(400).json({ error: 'Invalid collection name' });
  }

  try {
    const data = await db.collection(collectionName).find().toArray();
    res.json(data);
  } catch (err) {
    console.error(`Failed to fetch ${collectionName}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// DELETE product










// POST add product








// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });