const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
},
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;

      // Sequelize ORM ile bul veya oluştur (findOrCreate)
      // Sequelize'de if/else yazmanı engelliyor
      const [user, created] = await User.findOrCreate({
        where: { email: email },
        defaults: {
          password: null, // Sadece Google ile giriyorsa şifre yok
          role: 'user'
        }
      });

      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }));
