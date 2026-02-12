const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");

const app = express();
const PORT = 5001;

/* =========================
   MongoDB Connection
========================= */

const MONGO_URI =
  process.env.MONGO_URL ||
  "mongodb+srv://Adnan:Adnan%40678@cluster0.t6sxwhb.mongodb.net/Project?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

/* =========================
   Session Configuration
========================= */

app.use(
  session({
    secret: "gadgetgalaxysecret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

/* =========================
   Middleware
========================= */

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public"));

/* =========================
   Schemas & Models
========================= */

const userSchema = new mongoose.Schema({
  loginId: String,
  password: String,
});
const User = mongoose.model("Useraccounts", userSchema);

const contactSchema = new mongoose.Schema({
  FirstName: String,
  LastName: String,
  Email: String,
  PhoneNumber: Number,
  Comment: String,
});
const Contacts = mongoose.model("Contacts", contactSchema);

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
        },
      ],
      orderedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});
const Customer = mongoose.model("Customer", customerSchema);

const productsSchema = new mongoose.Schema({
  productName: String,
  price: Number,
});
const Product = mongoose.model("Products", productsSchema);

/* =========================
   Routes
========================= */

app.get("/", (req, res) => {
  res.render("index", { message: null });
});

/* ---------- Login ---------- */

app.post("/login", async (req, res) => {
  const { loginId, password } = req.body;
  const user = await User.findOne({ loginId, password });

  if (user) {
    if (loginId === "admin") {
      const customerData = await Customer.find();
      res.render("admin", { customers: customerData });
    } else {
      res.render("main", {
        loginId,
        customer: null,
        products: null,
        message: null,
      });
    }
  } else {
    res.render("index", { message: "Invalid login credentials!" });
  }
});

/* ---------- Register ---------- */

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

/* ---------- Logout ---------- */

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.render("index", { message: "You have been logged out!" });
});

/* ---------- Static Pages ---------- */

app.get("/mobiles", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "mobiles.html"));
});

app.get("/laptops", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "laptops.html"));
});

app.get("/speakers", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "speakers.html"));
});

app.get("/home", (req, res) => {
  res.render("main");
});

/* ---------- Contact ---------- */

app.get("/contact", (req, res) => {
  res.render("contactus");
});

app.post("/contact", async (req, res) => {
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
    res.status(500).send("Failed to add Contact");
  }
});

/* ---------- Cart ---------- */

app.post("/add-to-cart", (req, res) => {
  const { productName, price, image } = req.body;

  if (!req.session.cart) {
    req.session.cart = [];
  }

  req.session.cart.push({ productName, price, image });
  res.redirect("/cart");
});

app.get("/cart", (req, res) => {
  const cart = req.session.cart || [];
  res.render("cart", { cart });
});

app.post("/remove-from-cart", (req, res) => {
  const indexToRemove = parseInt(req.body.index);

  if (
    !isNaN(indexToRemove) &&
    req.session.cart &&
    req.session.cart.length > indexToRemove
  ) {
    req.session.cart.splice(indexToRemove, 1);
  }

  res.redirect("/cart");
});

/* ---------- Order Submission ---------- */

app.post("/submit-order", async (req, res) => {
  const { username, phone, address } = req.body;
  const cart = req.session.cart || [];

  try {
    if (cart.length === 0) {
      return res.render("cart", { cart, message: "Cart is empty!" });
    }

    let existingCustomer = await Customer.findOne({ name: username });

    if (existingCustomer) {
      existingCustomer.orders.push({ products: cart });
      await existingCustomer.save();
    } else {
      const newCustomer = new Customer({
        name: username,
        phone,
        address,
        orders: [{ products: cart }],
      });
      await newCustomer.save();
    }

    req.session.cart = [];
    res.render("cart", { cart: [], message: "Order placed successfully!" });
  } catch (error) {
    console.error("Order submission error:", error);
    res.status(500).send("Something went wrong.");
  }
});

/* ---------- View Previous Orders ---------- */

app.post("/orders", async (req, res) => {
  const { username } = req.body;

  try {
    const customer = await Customer.findOne({ name: username });

    if (!customer || customer.orders.length === 0) {
      return res.render("orders", { message: "No previous orders found.", orders: [] });
    }

    res.render("orders", { message: null, orders: customer.orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).send("Something went wrong.");
  }
});

/* ---------- Admin Data API ---------- */

app.get("/admin/data/:type", async (req, res) => {
  try {
    const type = req.params.type;

    let data;

    if (type === "useraccounts") {
      data = await User.find();
    } 
    else if (type === "contacts") {
      data = await Contacts.find();
    } 
    else if (type === "customers") {
      data = await Customer.find();
    } 
    else if (type === "products") {
      data = await Product.find();
    } 
    else {
      return res.status(400).json({ error: "Invalid type" });
    }

    res.json(data);

  } catch (error) {
    console.error("Admin data fetch error:", error);
    res.status(500).json({ error: "Server error" });
  }
});



/* =========================
   Start Server
========================= */

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
