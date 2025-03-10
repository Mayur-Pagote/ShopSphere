import User from "../models/userModel.js";
import asyncHandler from "../middleware/asyncHandler.js";
import bcrypt from "bcryptjs";
import generateToken from "../utils/createToken.js";

const createUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    throw new Error("Please fill all the fields");
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400)
    throw new Error("User already exists")
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = new User({ username, email, password: hashedPassword });

  try {
    await newUser.save();
    generateToken(res, newUser._id);
    res.status(201).json({
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      isAdmin: newUser.isAdmin,
    });
  } catch (error) {
    res.status(400);
    throw new Error("Invalid user data");
  }
});
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const isPasswordValid = await bcrypt.compare(
      password,
      existingUser.password
    );
    if (isPasswordValid) {
      generateToken(res, existingUser._id);
      res.status(200).json({
        _id: existingUser._id,
        username: existingUser.username,
        email: existingUser.email,
        isAdmin: existingUser.isAdmin,
      });
      return;
    }
    res.status(401)
    throw new Error("Wrong Password")
  }
  res.status(404)
  throw new Error("Please register the email address")
});
const logoutCurrentUser = asyncHandler(async (req, res) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: "Logged out successfully" });
});

const getAllUsers = asyncHandler(async (req, res, next) => {
  const users = await User.find({});
  res.json(users);
});

const getCurrentUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
    });
  } else {
    res.status(400);
    throw new Error("User not found");
  }
});

const updateCurrentUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user) {
    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(req.body.password, salt);
      user.password = hashedPassword;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
    });
  } else {
    res.status(400);
    throw new Error("User not found");
  }
});

const deleteUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    if (user.isAdmin) {
      res.status(400);
      throw new Error("Cannot delete admin");
    }

    await User.deleteOne({ _id: user._id });
    res.json({ message: "User removed" });
  }
  else {
    res.status(400);
    throw new Error("User not found");
  }
})

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (user) {
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
    });
  } else {
    res.status(400);
    throw new Error("User not found");
  }
});

const updateById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    user.username = req.body.username || user.username;
    user.email = req.body.email || user.email;
    user.isAdmin = Boolean(req.body.isAdmin) || user.isAdmin;

    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
    })
  }
  else {
    res.status(400);
    throw new Error("User not found");
  }
});

const googleSignIn = asyncHandler(async (req, res) => {
  const { googleId, email, username, photoURL } = req.body;

  if (!googleId || !email) {
    res.status(400);
    throw new Error("Google authentication data missing");
  }

  let existingUser = await User.findOne({ googleId });
  
  if (!existingUser) {
    existingUser = await User.findOne({ email });
  }

  if (existingUser) {
    existingUser.googleId = googleId;
    existingUser.photoURL = existingUser?.photoURL || photoURL;
    await existingUser.save();

    generateToken(res, existingUser._id);
    res.status(200).json({
      _id: existingUser._id,
      username: existingUser.username,
      email: existingUser.email,
      isAdmin: existingUser.isAdmin,
      photoURL: existingUser.photoURL
    });
    return;
  }

  const newUser = new User({
    username,
    email,
    googleId,
    photoURL,
    password: 'google-password'
  });

  try {
    await newUser.save();
    generateToken(res, newUser._id);
    res.status(201).json({
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      isAdmin: newUser.isAdmin,
      photoURL: newUser.photoURL
    });
  } catch (error) {
    res.status(400);
    throw new Error("Error creating user with Google authentication");
  }
});

const googleLogin = asyncHandler(async (req, res) => {
  console.log(req.body);

  const { googleId, email, username, photoURL } = req.body;

  if (!googleId || !email) {
    res.status(400);
    throw new Error("Google authentication data missing");
  }

  let existingUser = await User.findOne({ googleId });

  if (!existingUser) {
    existingUser = new User({
      username,
      email,
      googleId,
      photoURL,
      password: "google-password" 
    });

    try {
      await existingUser.save();
    } catch (error) {
      res.status(400);
      console.log(error);
      throw new Error("Error creating new user during Google login");
    }
  }

  try {
    generateToken(res, existingUser._id);
    res.status(200).json({
      _id: existingUser._id,
      username: existingUser.username,
      email: existingUser.email,
      isAdmin: existingUser.isAdmin,
      photoURL: existingUser.photoURL
    });
  } catch (error) {
    res.status(400);
    throw new Error("Error logging in with Google");
  }
});

export {
  createUser,
  loginUser,
  logoutCurrentUser,
  getAllUsers,
  getCurrentUserProfile,
  updateCurrentUserProfile,
  deleteUserById,
  getUserById,
  updateById,
  googleSignIn,
  googleLogin
};
