const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose');
//.set('debug', true);


// Connect to the db
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true }, (err, db) => {
  if(!err) {
    console.log("We are connected", mongoose.connection.readyState);
  }
  else {
    console.log("Error connecting - mother fucker", err);
  }
});

const Schema = mongoose.Schema;

const exercise = new Schema ({
  description: { type: String },
  duration: {type: Number},
  date: {type: Date},
});


const user = new Schema ({
//  ID: {type: Number, required: true},
  username: { type: String, required: true },
  exercises: [exercise],
  exerciseCount: {type: Number},
});

const users = mongoose.model("users", user);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post("/api/exercise/new-user", (req, res) => {
  console.log("In post with: ", req.body.username);
  
  var newUser = new users({username: req.body.username, exerciseCount: 0});
  
  newUser.save((saveErr, newUser) => {
            if (saveErr) { 
              console.error(saveErr);
              // some form of problem
              return res.send({"error" : "dB save error"});
            }
          });

  // console.log("ID: ", newUser._id);
  
  res.json({
            username: newUser.username,
            _id: newUser._id
          });
})


app.post("/api/exercise/add", (req, res) => {
  console.log("In post ADD with: ", req.body.userId);
  
  var date = req.body.date;
  
 // console.log(isExists(req.body.date));
  
  if (!date) {
    //date missing
    //date = date.now(); 
    date = new Date().toJSON().slice(0,10).replace(/-/g,'/');    
  }
  
  console.log("Date is", date, "with ID: ", req.body.userId);
  
//  users.findOneAndUpdate({_id: req.body.userId}, {description: req.body.description, duration: req.body.duration, date: date}, {useFindAndModify: false, new: true}, (err, user) => {
    users.findById(req.body.userId, (err, user) => {

      if (err) {
        console.log("Error in find and update");
        return res.send({"error" : "dB find and update error"});
      }
      else {
        if (!user) {
          //something is wrong - not found
          console.log(user, ": Not found");
          return res.send({"error" : "dB find error"});
        }
        
        // console.log(user);
        user.exercises.push({description: req.body.description, duration: req.body.duration, date: date});
        user.exerciseCount++;
        console.log(user.exerciseCount, "Exercises now");
        
       // console.log(user);
        
        user.save((err) => {
          if (err) {
            console.error(err);
            // some form of problem
            return res.send({"error" : "dB save error"});
          }
          else{
            res.json(user);        
          }
        });
      }
  })
  
})

app.get("/api/exercise/log", (req, res) => {
  //console.log("In Get Logs with ID: ", req.query, req.query.userId);
  
  users.findById(req.query.userId, (err, user) => {

      if (err) {
        console.log("Error in find user log");
        return res.send({"error" : "dB find user log error"});
      }
      else {
        if (!user) {
          //something is wrong - not found
          console.log(req.query.userId, ": Not found");
          return res.send({"error" : "dB find error in user logs"});
        }
        else {
          console.log("Found User in GET log API");
          // console.log(user.exercises);
          // console.log("id: ", user._id);
          
          const userId = req.query.userId.toString() || null;
          const from = Date.parse(req.query.from) || null;
          const to = Date.parse(req.query.to) || null;
          const limit = parseInt(req.query.limit) || null;

          const params = { userId, from, to, limit };

           // filter log
          var filteredLog = [...user.exercises];

          //console.log(user.exercises);
          
          //console.log(filteredLog);
          
          
          if (from) filteredLog = filteredLog.filter(exercise => exercise.date > from);
          if (to) filteredLog = filteredLog.filter(exercise => exercise.date < to);
          if (limit) filteredLog = filteredLog.slice(0, limit);

          // convert date to human-readable format
          filteredLog = filteredLog.map(exercise => {
            const formatedDate = new Date(exercise.date).toDateString();
            const { description, duration } = exercise;
            return { description, duration, date: formatedDate };            
          });
          
          console.log(filteredLog);
          
          /* if (req.query.limit) {
            
            console.log("Found Limit :", req.query.limit);
          
          }
  
         else if (req.query.from && req.query.to) {
            // both a from and to date in query
            
            console.log("Found Date limits: ", req.query.from, req.query.to);
            
            var exerciseLog = user.exercises;
            
          }  
        
          */
          
          res.json({Log: filteredLog, count: user.exerciseCount});

        } 
      }
  });
})

app.get("/api/exercise/users", (req, res) => {
  console.log("In get Users");
  users.find({}, 'username', (err, users) => {
    if (err) {
      console.log("Error in find - users");
      res.send({"error" : "dB find error"});
    }
    else {
      res.json(users);
    }
  })
})

app.get("/api/exercise/delete", (req, res) => {
  users.deleteMany((err, users) => {
    if (err) {
      console.log("Error in delete");
      res.send({"error" : "dB delete error"});
    }
    console.log("Deleted dB hopefully");
    res.send(users);
  })
})



// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
