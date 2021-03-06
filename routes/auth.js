//=============================
//AUTHENTICATION routes
//=============================
var express = require('express');
var router = express.Router();
var passport = require('passport');
const moment = require('moment');

const Calendar = require('../models/calendar');
const Review = require('../models/review');
var Wordcard = require('../models/wordcards.js');
var User = require('../models/users.js');

router.post('/join', function(req, res) {
  var newUser = new User({ username: req.body.username });
  User.register(newUser, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      return res.render('join');
    }
    passport.authenticate('local')(req, res, function() {
      res.redirect('/settings');
    });
  });
});

router.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/home',
    failureRedirect: '/login'
  }),
  function(req, res) {}
);

router.get('/home', isLoggedIn, async (req, res) => {
  // data for calender
  let userCalendarData = await Calendar.findOne({ author: req.user._id });
  let point = 1; // add a word, point 1
  let today = moment().format('DD-MM-YYYY');
  let timestamp = moment().unix();
  let itemToSave = {
    date: today,
    timestamp,
    point,
    isTodayAlreadyLoggedIn: true
  };
  // end
  const wordcards = await Wordcard.find({ author: req.user._id });
  const user = await User.findOne(
    { username: req.user.username },
    'dailyReviewComplete'
  );
  let todaysCard = [];
  const todaysWordCardsDoc = await Review.findOne({ author: req.user._id });
  // if card collection have the data send it
  if (todaysWordCardsDoc) {
    todaysCard = todaysWordCardsDoc.wordcards;
    // just another redirect so that it can be saved on calendar DB
    // Now everything save, so add +1 point to show in calendar

    if (!userCalendarData) {
      // This user yet don't have any activity in calendar
      // first create an entry for this user
      new Calendar({
        author: req.user._id,
        username: req.user.username
      })
        .save()
        .then(newCalendarDoc => {
          // add data to users model (Calendar) data array
          Calendar.findOne({ author: req.user._id }).then(calendarDoc => {
            calendarDoc.data.unshift(itemToSave);
            calendarDoc
              .save()
              .then(userCalendar => {
                return res.render('dashboard', {
                  wordcards,
                  user,
                  todaysCard
                });
              })
              .catch(err => res.status(404).json(err));
          });
        });
    } else {
      // user already have an entry in calendar db
      let calendarDoc = userCalendarData;
      // add data to users model (Calendar) data array
      let daysArray = calendarDoc.data.map(singleItem => singleItem.date);

      if (!daysArray.includes(today)) {
        // you have to push new item[today]

        // add data to users model (Calendar) data array
        Calendar.findOne({ author: req.user._id }).then(calendarDoc => {
          calendarDoc.data.unshift(itemToSave);
          calendarDoc
            .save()
            .then(userCalendar => {
              return res.render('dashboard', {
                wordcards,
                user,
                todaysCard
              });
            })
            .catch(err => res.status(404).json(err));
        });
      } else {
        // console.log('sending---------->', todaysCard);

        return res.render('dashboard', {
          wordcards,
          user,
          todaysCard
        });
      }
    }
  } else {
    console.log(
      'Recalculating everything & saving to Review collection for today future use!'
    );
    // calculate the RepetitioFactor and save it to Review collection for today future use

    if (wordcards.length > 0) {
      // pull out the RepetitioFactor value
      let wordcardsWithRepetitioFactor = wordcards.map(x => {
        return {
          ...x._doc,
          repetitioFactor: x.get('RepetitioFactor'),
          reviewed: false
        };
      });
      // get the maxReview of current user
      let maxReview = await User.findOne({ username: req.user.username }).then(
        userDocument => userDocument.maxReview
      );
      if (maxReview) {
        // get the RepetitioFactor under 0.5 and over 0.5
        let wordcardsUnderPointFiveRepetitioFactor = [];
        let wordcardsOverPointFiveRepetitioFactor = [];
        wordcardsWithRepetitioFactor.forEach(singleCard => {
          if (parseFloat(singleCard.repetitioFactor) < 0.5) {
            wordcardsUnderPointFiveRepetitioFactor.push(singleCard);
          } else {
            wordcardsOverPointFiveRepetitioFactor.push(singleCard);
          }
        });

        let finalCards = [];
        if (wordcardsUnderPointFiveRepetitioFactor.length >= maxReview) {
          for (let index = 0; index < maxReview; index++) {
            finalCards.push(wordcardsUnderPointFiveRepetitioFactor[index]);
          }
        } else {
          finalCards = [...wordcardsUnderPointFiveRepetitioFactor];
        }
        // Now calculation is complete
        // save the data to Review collection for today future use
        let dbuser = await Review.findOne({ author: req.user._id });

        if (!dbuser) {
          // This user yet don't have any activity in Review
          // first create an entry for this user
          new Review({
            author: req.user._id,
            username: req.user.username
          })
            .save()
            .then(newCardDoc => {
              // save the data to Review collection for today future use
              Review.findOne({
                author: req.user._id
              }).then(CardDoc => {
                CardDoc.wordcards = [...finalCards];
                CardDoc.save()
                  .then(userCard => {
                    todaysCard = userCard.wordcards;
                    // just another redirect so that it can be saved on calendar DB
                    // Now everything save, so add +1 point to show in calendar

                    if (!userCalendarData) {
                      // This user yet don't have any activity in calendar
                      // first create an entry for this user
                      new Calendar({
                        author: req.user._id,
                        username: req.user.username
                      })
                        .save()
                        .then(newCalendarDoc => {
                          // add data to users model (Calendar) data array
                          Calendar.findOne({ author: req.user._id }).then(
                            calendarDoc => {
                              calendarDoc.data.unshift(itemToSave);
                              calendarDoc
                                .save()
                                .then(userCalendar => {
                                  return res.render('dashboard', {
                                    wordcards,
                                    user,
                                    todaysCard
                                  });
                                })
                                .catch(err => res.status(404).json(err));
                            }
                          );
                        });
                    } else {
                      // user already have an entry in calendar db
                      let calendarDoc = userCalendarData;
                      // add data to users model (Calendar) data array
                      let daysArray = calendarDoc.data.map(
                        singleItem => singleItem.date
                      );

                      if (!daysArray.includes(today)) {
                        // you have to push new item[today]

                        // add data to users model (Calendar) data array
                        Calendar.findOne({ author: req.user._id }).then(
                          calendarDoc => {
                            calendarDoc.data.unshift(itemToSave);
                            calendarDoc
                              .save()
                              .then(userCalendar => {
                                return res.render('dashboard', {
                                  wordcards,
                                  user,
                                  todaysCard
                                });
                              })
                              .catch(err => res.status(404).json(err));
                          }
                        );
                      } else {
                        // console.log('sending---------->', todaysCard);

                        return res.render('dashboard', {
                          wordcards,
                          user,
                          todaysCard
                        });
                      }
                    }
                  })
                  .catch(err => res.status(404).json(err));
              });
            });
        } else {
          Review.findOne({
            author: req.user._id
          }).then(CardDoc => {
            CardDoc.wordcards = [...finalCards];
            CardDoc.save()
              .then(userCard => {
                todaysCard = userCard.wordcards;
                // just another redirect so that it can be saved on calendar DB
                // Now everything save, so add +1 point to show in calendar

                if (!userCalendarData) {
                  // This user yet don't have any activity in calendar
                  // first create an entry for this user
                  new Calendar({
                    author: req.user._id,
                    username: req.user.username
                  })
                    .save()
                    .then(newCalendarDoc => {
                      // add data to users model (Calendar) data array
                      Calendar.findOne({ author: req.user._id }).then(
                        calendarDoc => {
                          calendarDoc.data.unshift(itemToSave);
                          calendarDoc
                            .save()
                            .then(userCalendar => {
                              return res.render('dashboard', {
                                wordcards,
                                user,
                                todaysCard
                              });
                            })
                            .catch(err => res.status(404).json(err));
                        }
                      );
                    });
                } else {
                  // user already have an entry in calendar db
                  let calendarDoc = userCalendarData;
                  // add data to users model (Calendar) data array
                  let daysArray = calendarDoc.data.map(
                    singleItem => singleItem.date
                  );

                  if (!daysArray.includes(today)) {
                    // you have to push new item[today]

                    // add data to users model (Calendar) data array
                    Calendar.findOne({ author: req.user._id }).then(
                      calendarDoc => {
                        calendarDoc.data.unshift(itemToSave);
                        calendarDoc
                          .save()
                          .then(userCalendar => {
                            return res.render('dashboard', {
                              wordcards,
                              user,
                              todaysCard
                            });
                          })
                          .catch(err => res.status(404).json(err));
                      }
                    );
                  } else {
                    // console.log('sending---------->', todaysCard);

                    return res.render('dashboard', {
                      wordcards,
                      user,
                      todaysCard
                    });
                  }
                }
              })
              .catch(err => res.status(404).json(err));
          });
        }
      } else {
        // just another redirect so that it can be saved on calendar DB
        // Now everything save, so add +1 point to show in calendar

        if (!userCalendarData) {
          // This user yet don't have any activity in calendar
          // first create an entry for this user
          new Calendar({
            author: req.user._id,
            username: req.user.username
          })
            .save()
            .then(newCalendarDoc => {
              // add data to users model (Calendar) data array
              Calendar.findOne({ author: req.user._id }).then(calendarDoc => {
                calendarDoc.data.unshift(itemToSave);
                calendarDoc
                  .save()
                  .then(userCalendar => {
                    return res.render('dashboard', {
                      wordcards,
                      user,
                      todaysCard
                    });
                  })
                  .catch(err => res.status(404).json(err));
              });
            });
        } else {
          // user already have an entry in calendar db
          let calendarDoc = userCalendarData;
          // add data to users model (Calendar) data array
          let daysArray = calendarDoc.data.map(singleItem => singleItem.date);

          if (!daysArray.includes(today)) {
            // you have to push new item[today]

            // add data to users model (Calendar) data array
            Calendar.findOne({ author: req.user._id }).then(calendarDoc => {
              calendarDoc.data.unshift(itemToSave);
              calendarDoc
                .save()
                .then(userCalendar => {
                  return res.render('dashboard', {
                    wordcards,
                    user,
                    todaysCard
                  });
                })
                .catch(err => res.status(404).json(err));
            });
          } else {
            // console.log('sending---------->', todaysCard);

            return res.render('dashboard', {
              wordcards,
              user,
              todaysCard
            });
          }
        }
      }
    } else {
      // just another redirect so that it can be saved on calendar DB
      // Now everything save, so add +1 point to show in calendar

      if (!userCalendarData) {
        // This user yet don't have any activity in calendar
        // first create an entry for this user
        new Calendar({
          author: req.user._id,
          username: req.user.username
        })
          .save()
          .then(newCalendarDoc => {
            // add data to users model (Calendar) data array
            Calendar.findOne({ author: req.user._id }).then(calendarDoc => {
              calendarDoc.data.unshift(itemToSave);
              calendarDoc
                .save()
                .then(userCalendar => {
                  return res.render('dashboard', {
                    wordcards,
                    user,
                    todaysCard
                  });
                })
                .catch(err => res.status(404).json(err));
            });
          });
      } else {
        // user already have an entry in calendar db
        let calendarDoc = userCalendarData;
        // add data to users model (Calendar) data array
        let daysArray = calendarDoc.data.map(singleItem => singleItem.date);

        if (!daysArray.includes(today)) {
          // you have to push new item[today]

          // add data to users model (Calendar) data array
          Calendar.findOne({ author: req.user._id }).then(calendarDoc => {
            calendarDoc.data.unshift(itemToSave);
            calendarDoc
              .save()
              .then(userCalendar => {
                return res.render('dashboard', {
                  wordcards,
                  user,
                  todaysCard
                });
              })
              .catch(err => res.status(404).json(err));
          });
        } else {
          // console.log('sending---------->', todaysCard);

          return res.render('dashboard', {
            wordcards,
            user,
            todaysCard
          });
        }
      }
    }
  }
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

router.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/landing');
});

module.exports = router;
