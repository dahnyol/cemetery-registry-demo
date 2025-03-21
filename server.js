const express = require('express');
const app = express();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Connect to supabase DB
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Parse URL data into object for POST and PUT requests to server
app.use(express.urlencoded({extended:true}));
app.use(express.json());

// Set server to expect EJS and where to find it
app.set('view engine', 'ejs');
app.set('views', './views');

// Set path to CSS style
app.use('/', express.static('public'));

// Routes
// GET to render our homepage
app.get('/', (req, res) => {
    res.render('index', {records: null});
})

// GET to fetch DB data
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