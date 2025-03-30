const express = require('express');
const app = express();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const session = require('express-session');

// Connect to supabase DB
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware
// Parse URL data into object for POST and PUT requests to server
app.use(express.urlencoded({extended:true}));
app.use(express.json());

// Set server to expect EJS and where to find it
app.set('view engine', 'ejs');
app.set('views', './views');

// Set path to CSS style
app.use('/', express.static('public'));

// Set session length to 10 minutes
app.use(session({
    secret: 'your secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        maxAge: 600000,       
    }
}))

// Routes
// GET to render our homepage
app.get('/', (req, res) => {
    res.render('index', {records: null});
})

// GET to render login page
app.get('/loginPage', (req, res) => {
    res.render('login');
});

// GET to render update page
app.get('/updatePage', (req, res) => {
    if (req.session.authenticated) {
        res.render('update', {records: null, message: null});
    } else {
        res.render('login');
    }
});

// Handle login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    let { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password,
    })
    
    if (error) {
        console.error('login error', error.message);
        return res.status(401).send('Login failure. Please contact administrator.');
    }
    
    // Authenticate current user session
    // If multiple users - need to add query to match/specify userId in DB
    req.session.userId = 'admin';
    req.session.authenticated = true;

    res.redirect('/updatePage');
})

// If multiple users - modify session.destroy to target specific user id 
app.get('/logout', (req, res) => {
    req.session.destroy((error => {
        if (error) {
            console.error('Session not destroyed', error.message);
            return res.status(500).send('Could not log out, please try again');
        }
        res.redirect('/'); // Redirect to home page or login page after logging out
    }))
})

// Show existing DB date for record to update
app.get('/getUpdateRecord', async (req, res) => {
    const memorialID = req.query.memorialID;
    // Select field_names from cemetery_records where memorial_id eq memorialID var value
    let query = supabase
        .from('cemetery_records')
        .select(`
            memorial_ID,
            last_name,
            maiden_name,
            first_name,
            middle_name,
            title,
            birth_date,
            death_date,
            age,
            is_veteran,
            section,
            lot,
            moved_from,
            moved_to,
            notes`)
        .eq('memorial_ID', memorialID)
    
    try {
        let { data, error } = await query;
        if (error) {
            throw error;
        } 
        // Supabase returns array of objects, store object into var 
        let dataObject = data[0];
        if (dataObject) {
            res.render('update', {record: dataObject});
        } else {
            res.render('update', {record: null, message: "No record found, please try again."});
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
})

// Update our DB with our new data sent in form 
app.post('/updateRecord', async (req, res) => {
    if (req.session.authenticated) {
        try {
            const updatedData = await updateRecordInSupabase(req.body);
            res.render('update', {record: null, message: "Record update successful"});
        } catch (error) {
            console.error('Error updating record:', error);
            res.render('update', {message: "Error updating record. Update not successful"});
        }
    } else {
        res.render('login');
    }
})

async function updateRecordInSupabase(formData) {
    try {
        const recordId = formData.memorial_ID;
        // Before Updating all fields in record object, delete the memorial_ID from object to preserve the ID
        delete formData.memorial_ID;
        const { data, error } = await supabase
            .from('cemetery_records')
            .update(formData)
            .eq('memoral_ID', recordId)

        if (error) throw error;
    } catch (error) {
        console.error('Error updating record in Supabase:', error);
        throw error; // re-throw the error to tbe handled by the calling function
    }
}

// Search for specific data
// GET to fetch DB data - main page
app.get('/search', async (req, res) => {
    // Grab data from form and store to appropriate var
    const { lastName, firstName, birthYear, deathYear } = req.query;
    
    // Define/Create SQL prompt to search supabase DB
    // select * from cemetery_records where name_last like ('%lastName%') order by name_last asc;
    let query = supabase
        .from('cemetery_records')
        .select(`last_name,
            maiden_name,
            first_name,
            middle_name,
            title,
            birth_date,
            death_date,
            age,
            is_veteran,
            section,
            lot,
            moved_from,
            moved_to,
            notes`)
        .order('last_name', {ascending: true});

    // Partial match will return 
    if (lastName) {
        query = query.ilike('last_name', `%${lastName}%`);
    }
    if (firstName) {
        query = query.ilike('first_name', `%${firstName}%`);
    }

    // Exact match will return
    if (birthYear) {
        query = query.eq('birth_year', birthYear);
    }
    if (deathYear) {
        query = query.eq('death_year', deathYear);
    }
    
    // GET request with defined SQL prompt/query to supabase DB
    try {
        console.log(query);
        let { data, error } = await query
        if (error) {
            throw error;
        }
        res.render('index', {records: data});
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).send('Internal Server Error');        
    }
})

app.listen(process.env.PORT, () => {
    console.log(`Server is running ${process.env.PORT}`);
})