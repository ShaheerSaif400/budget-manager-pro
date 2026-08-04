const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Blog Posts Static Data
const blogPosts = [
  {
    id: '1',
    title: 'The 50/30/20 Rule for Personal Finance',
    category: 'Budgeting',
    badgeColor: 'success',
    readTime: '5 min read',
    date: 'Jul 2026',
    image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
    summary: 'Learn how allocating 50% for needs, 30% for wants, and 20% for savings can transform your monthly budget balance.',
    content: `
      <p class="mb-4">Managing money effectively doesn't require a degree in finance. One of the simplest and most effective frameworks is the <strong>50/30/20 budget rule</strong>.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">1. 50% for Needs</h3>
      <p class="mb-4">Needs are expenses you cannot avoid. These include housing, utilities, groceries, transportation, and basic insurance. Exactly half of your after-tax income should cover these core essentials.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">2. 30% for Wants</h3>
      <p class="mb-4">Wants are items that aren't strictly necessary for survival but enhance your lifestyle—dining out, entertainment, hobbies, and vacation travel. Budgeting 30% allows you to enjoy life without financial guilt.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">3. 20% for Savings & Debt Repayment</h3>
      <p class="mb-4">The final 20% goes directly toward your future. Put this portion into emergency reserves, retirement accounts, or paying down high-interest debt.</p>
    `
  },
  {
    id: '2',
    title: '10 Simple Ways to Cut Monthly Expenses',
    category: 'Savings',
    badgeColor: 'primary',
    readTime: '4 min read',
    date: 'Jul 2026',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80',
    summary: 'Identify hidden cash leaks and unnecessary subscription charges to save more money every single month.',
    content: `
      <p class="mb-4">Small daily leaks can add up to a major drain on your finances. Cutting monthly expenses doesn't mean sacrificing your lifestyle entirely.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">Audit Unused Subscriptions</h3>
      <p class="mb-4">Review your bank statements for recurring subscriptions. Cancel streaming services, app memberships, or gym plans you rarely use.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">Cook at Home & Plan Meals</h3>
      <p class="mb-4">Dining out or ordering food delivery frequently is one of the quickest ways to blow a budget. Planning weekly meals drastically cuts down food costs.</p>
    `
  },
  {
    id: '3',
    title: 'Emergency Funds vs. Investments',
    category: 'Investing',
    badgeColor: 'warning',
    readTime: '6 min read',
    date: 'Jul 2026',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
    summary: 'Why building a 3-month liquid cash reserve is required before jumping into stocks or crypto investments.',
    content: `
      <p class="mb-4">Before putting your hard-earned money into stock markets, real estate, or crypto, having a solid financial foundation is critical.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">Why an Emergency Fund Comes First</h3>
      <p class="mb-4">An emergency fund acts as financial insurance. It covers unexpected medical bills, car repairs, or sudden income loss without forcing you to sell investments at a loss.</p>
      <h3 class="fw-bold text-dark mt-4 mb-3">Transitioning to Long-Term Investments</h3>
      <p class="mb-4">Once you have 3 to 6 months of living expenses safely stored in an accessible savings account, you can confidently invest excess capital into growth assets.</p>
    `
  }
];

// GET: Landing Page
exports.getLanding = (req, res) => {
  res.render('landing', { user: req.session.user || null });
};

// GET: Login Page
exports.getLogin = (req, res) => {
  res.render('login', { user: req.session.user || null });
};

// POST: Login Handle
exports.postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const checkUser = await User.findOne({ email });

    if (!checkUser) return res.send('User not found!');

    const match = await bcrypt.compare(password, checkUser.password);
    if (!match) return res.send('Incorrect password!');

    req.session.user = checkUser;
    res.redirect('/dashboard');
  } catch (err) {
    res.status(500).send('Login Error');
  }
};

// GET: Signup Page
exports.getSignup = (req, res) => {
  res.render('signup', { user: req.session.user || null });
};

// POST: Signup Handle
exports.postSignup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.send('Email already exists');

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash(password, salt);

    let avatarPath = '';
    if (req.file) {
      avatarPath = '/uploads/' + req.file.filename;
    }

    await User.create({
      name,
      email,
      password: passHash,
      avatar: avatarPath
    });

    res.redirect('/login');
  } catch (err) {
    console.error("Signup Error Detailed:", err);
    res.status(500).send('Signup Error: ' + err.message);
  }
};

// GET: Blogs List
exports.getBlogs = (req, res) => {
  res.render('blogs', {
    blogs: blogPosts,
    user: req.session.user || null
  });
};

// GET: Single Blog Detail
exports.getBlogById = (req, res) => {
  const blogId = req.params.id;
  const blog = blogPosts.find(b => b.id === blogId);

  if (!blog) {
    return res.status(404).send('Blog article not found.');
  }

  res.render('blog-detail', {
    blog,
    user: req.session.user || null
  });
};

// GET: Logout
exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
};