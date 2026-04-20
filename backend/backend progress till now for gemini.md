
## folder structure:
folder/
├── database/             ← Database configuration or migration files
├── node_modules/         ← Project dependencies
├── public/               ← Static assets and frontend views
│   ├── css/   
│   │    └── style.css              
│   ├── js/            
│   │    └── nav.js     
│   ├── penapp/  
│   │   ├── app.js
│   │   ├── penapp-ext.js
│   │   ├── stmng.js
│   │   ├── index.html 
│   │   ├── esp32_central_v4.ino 
│   │   ├── wemos_examinee_v5.ino
│   │   └── style.css       
│   ├── allsessions.html  
│   ├── camera.html       
│   ├── candidate.html    
│   ├── dashboard.html    
│   ├── history.html      
│   ├── incidents.html    
│   ├── login.html        
│   ├── session.html  
│   └── students-list.html      
├── recordings/           ← Storage for recorded media/streams
├── src/                  ← Application source code
│   ├── middleware/       ← Express middleware (e.g., auth, logging)
│   │   └── auth.js 
│   ├── pages/
│   │   └── router.js     ← Routes serving the HTML files from /public
│   ├── routes/
│   │   ├── auth.js       ← Authentication logic
│   │   ├── feeds.js      ← Video feed/stream management
│   │   ├── history.js    
│   │   ├── incidents.js  
│   │   ├── penlog.js     
│   │   ├── sessions.js   
│   │   ├── signals.js    
│   │   ├── stats.js     
│   │   └── students.js       
│   ├── db.js             ← Database connection/pool setup
│   ├── index.js          ← Main entry point for the server
│   ├── inferenceClient.js ← Client for AI/Inference processing
│   ├── recorder.js       ← Logic for handling media recording
│   └── wsHandler.js      ← WebSocket connection handling
├── .env                  ← Environment variables
├── .gitignore            ← Git exclusion rules
├──  package.json
└── .gitkeep              ← Ensures empty directories are tracked





## code:











## current objective:
right now we are working proctopenapp's grid cards. this will be used instead of the dashboard moving forward but hasnt been fully fixed so we will do that last. we are trying to make the grid cards modal window work by adjusting some things in there.


## current issues:

if you must modify code in the app.js file in order to fix the issues im listing (as in not even adding features in the penapp-ext.js isnt going to fix it), let me know where and why and the code in a different js file (patch-app.js or something like that) and where those changes should be done (like for adding a function, let me know of which line it should be pasted in and what code or function should be above and below the function you need implemented).

frontend issues

remove the edit and fluff you made for recommending the usb serial option. we will highlight it ourselves during demo so that it doesnt appear special.  i said it was most reliable for testing as letting you know, not to implement it. 

make the modal window design a bit landscape shaped and maybe a bit bigger. meaning longer on the sides. keep the top to bottom height tho. and we will need to move some of the divs around. 

leave the top part about unit number and address unchanged.



regarding the live feed. what you need to do is move the live feed to the top left and takes up around 60 percent of the sides and just below it should be the camera link field and alert confidence percentage or guage based on ai inference detections. 

from the top right should be the search drop down box for selecting students and right below that should be the field boxes that shows the results of the selection (student name and id for now and we can add other things later). would it be possible to search for students by writing parts of their name and id together  (currently i can only search up name or id as trying to do both partially leads no values being loaded)? and the buttons my friend made in the bottom.

basically kind of what was done for the candidate page but without logs or buttons (im saying no buttons as in you do not need to fiddle with the buttons by editing their functions. just have to move the buttons the pen friend already made)

regarding alerts, could you check if what i coded for notifying the admin about alert levels from inference going to work? i cant test it on my machine so im reliant on you for this. 




backend issues:

theres an issue of the remove student button not working properly after clicking save button for student details . the assign button doesnt work either as the fields for saving student details doesnt get auto filled after clicking assign.

camera link disappears in the modal window after we close the modal window and check back.

student details should be auto loaded into the student name and student id fields. maybe make these two divs into one and removing the selected student panel that appears after selecting from the search student drop down.

theres also another issue which is data persistence. previous data saved for the unit by using the current student name and id still staying after ending a session and refreshing the page. 


the biggest issue right now is when the proctopen page gets refreshed, everything gets erased but still some data persists like student data that got entered and saved by using the current text fields in the top.


side question: should we remove the students pen unit id? i dont see much use of it being there.

