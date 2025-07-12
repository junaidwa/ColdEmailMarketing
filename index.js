const express = require("express");
const app = express();
const nodemailer = require("nodemailer");
const path = require("path");
const multer = require("multer");
const User = require("./models/user"); // Assuming you have a User model defined in models/user.js
const mongoose = require("mongoose");
const passport = require("passport");
const session = require('express-session');
const LocalStrategy = require('passport-local').Strategy;
//multer configuration
const EJSmate = require("ejs-mate");
app.engine("ejs", EJSmate);

// const upload = multer({
//   dest: "uploads/",
//   limits: { fileSize: 1000000 }, // Limit file size to 1MB
// });
let extractedEmails = [];

//views setting
app.set("view engine", "ejs");
app.set("views", "./views");
//body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));



const methodOverride = require("method-override");
app.use(methodOverride("_method"));



app.use(session({
  secret: 'your-secret-key', // Change this to a real secret
  resave: false,
  saveUninitialized: false,
  cookie: { 
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 1 week
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));


const flash = require('connect-flash');

// Add this after session middleware but before passport middleware
app.use(flash());



app.use(passport.initialize());
app.use(passport.session());



app.use((req, res, next) => {
    res.locals.success = req.flash("success"); // Make success messages available in views
  res.locals.error = req.flash("error"); 
  res.locals.currentUser = req.user; // Passport stores the authenticated user in req.user
  res.locals.currentPath = req.path; // Current URL path
  next();
});

const port = 3000;

app.get("/", (req, res) => {
  res.render("index");
});

const Mongo_URL = "mongodb://127.0.0.1:27017/MyReach";

async function main() {
  await mongoose.connect(Mongo_URL);
}

main()
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    a;
    console.error("Error connecting to MongoDB:", err);
  });


passport.use(new LocalStrategy(
  {
    usernameField: 'email' // using email as username
  },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return done(null, false, { message: 'Incorrect email' });
      }
      
      // Assuming your User model has an authenticate method from passport-local-mongoose
      // or you've implemented your own password verification
      user.authenticate(password, (err, result) => {
        if (err) return done(err);
        if (!result) return done(null, false, { message: 'Incorrect password' });
        return done(null, user);
      });
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser(User.serializeUser()); // If using passport-local-mongoose
passport.deserializeUser(User.deserializeUser());







app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    // failureFlash: true,
  }),
  async (req, res) => {
    let redirectURL = res.locals.returnTO || "/";
    req.flash('success', 'Logged in successfully!');
    res.redirect('/');
  }
);

app.get("/signup", (req, res) => {
  res.render("signup.ejs");
  // res.send("SignUp Page is under construction, please wait for a while")
});

app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;
  const NewUser = new User({
    username,
    email,
  });
  const resutdata = await User.register(NewUser, password);

  console.log(resutdata);

req.login(resutdata, (err) => {
  if (err) {
    return next(err);
  }
  req.flash('success', 'Signin in successfully!');
  res.redirect("/");
});

});

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
      req.flash('success', 'Logged out successfully!');
    res.redirect('/');

    // res.redirect("/listings");
  });
});

app.get('/addsenders',(req,res)=>{
  res.render('Addsender.ejs');
})


app.get('/SendMail',(req,res)=>{
  res.render('SendMail.ejs');

})





app.get("/upload", (req, res) => {
  res.render("upload");
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Append extension
  },
});

const upload = multer({ storage: storage, limits: { fileSize: 1000000 } }); // Limit file size to 1MB

const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

app.post("/upload", upload.single("document"), async (req, res) => {
  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();
  let textContent = "";

  try {
    if (ext === ".txt") {
      textContent = fs.readFileSync(filePath, "utf8");
    } else if (ext === ".pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      textContent = pdfData.text;
    } else if (ext === ".docx") {
      const docxBuffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: docxBuffer });
      textContent = result.value;
    } else {
      return res.send("Unsupported file type.");
    }

    // console.log("Extracted Text:", textContent);

    // Extract email addresses (if needed)
    const emails =
      textContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g) || [];
    console.log("Extracted Emails:", emails);

    // ✅ You can now:
    // - Store emails in DB
    // - Send bulk emails via nodemailer
    // - Show on frontend, etc.

    extractedEmails = emails;

    req.flash('success', 'Document uploaded and emails extracted successfully!');

    res.redirect('/SendMail');
  } catch (err) {
    console.error("Error processing file:", err);
    res.status(500).send("Error extracting data from file.");
  }
});

const senderCredentials = {
  "junaidwattoo33@gmail.com": "qhbtddqjgemituqb",
  "jwattoo564@gmail.com": "nmwlstqpzsunhran",
};

app.post("/SendMail", async (req, res) => {
  const ExtractMail = extractedEmails;
  const mailtext = req.body.text;
  const sender = req.body.sender;

  const SenderAdmin = senderCredentials[sender];

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: sender,
      pass: SenderAdmin, // Consider using environment variables instead of hardcoding passwords
    },
  });SenderAdmin

  //   const mailText = "Slam! I am Muhammad Junaid!";

  const info = await transporter.sendMail({
    from: `"Code and Develope" <${sender}>`,
    to: ExtractMail,
    subject: "Use Nodemailer for sending emails",
    text: mailtext,
  });

  console.log("Message sent:", info.messageId);
  console.log("Text sent:", mailtext); // Manually print the text sent
     req.flash('success', 'Email Sent Successfully successfully!');
     res.redirect('/');

});
// Create a test account or replace with real credentials.

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
