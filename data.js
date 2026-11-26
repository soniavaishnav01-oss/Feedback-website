'use strict';
// Campaign categories. Each field: key|label|kind|required  (kinds: t text, u url, a long text, s:Opt1,Opt2 select)
const CATS = {
  website: { n: 'Website testing', d: 'Explore a website and judge its design, clarity and usability.', f: ['url|Website URL or testing link|u|1', 'goal|Main testing objective|t|1', 'pages|Pages to explore|t|0', 'actions|Specific actions to perform|a|0', 'device|Device preference|s:Any,Mobile,Desktop|0', 'competitors|Competitor websites|t|0'] },
  app: { n: 'App testing', d: 'Try a mobile or web app and report bugs and confusion.', f: ['platform|Platform|s:Android,iOS,Web|1', 'access|App link or access instructions|a|1', 'goal|Testing objective|t|1', 'features|Features to test|t|0', 'scenarios|Required scenarios|a|0', 'known|Known bugs to ignore|t|0', 'account|Test account instructions (dummy data only)|a|0'] },
  survey: { n: 'Survey feedback', d: 'Understand preferences, opinions and behaviour.', f: ['goal|Research objective|t|1', 'link|External survey link|u|0', 'time|Estimated completion time|t|1', 'screening|Screening questions|a|0', 'exclude|Exclusion criteria|t|0'] },
  product: { n: 'Product / service feedback', d: 'Collect opinions on a product or service.', f: ['pcat|Product category|t|1', 'learn|What do you want to learn?|a|1', 'link|Product link or image link|u|0', 'price|Product price|t|0', 'criteria|Evaluation criteria|t|0', 'competitors|Competitor products|t|0'] },
  idea: { n: 'Business idea validation', d: 'Test whether a problem exists and a solution appeals.', f: ['problem|Problem being investigated|a|1', 'solution|General description of the solution|a|1', 'goal|Research objective|t|1', 'industry|Industry|t|0', 'alternatives|Existing alternatives|t|0', 'pricing|Pricing assumptions|t|0'] },
  design: { n: 'Brand / logo / design feedback', d: 'Learn how people perceive your design.', f: ['dcat|Design category|t|1', 'image|Link to the design image|u|1', 'eval|What should be evaluated?|a|1', 'versions|Alternative versions (links)|t|0', 'personality|Brand personality|t|0', 'colours|Colour preferences|t|0'] }
};
// Suggested questions. Prefix: # = rating 1–5, ? = yes/no, otherwise long answer.
const SUGG = {
  website: ['What was your first impression of this website?', '?Could you understand what the business offers within a few seconds?', '#How easy was it to navigate the website?', 'Could you find the information you were looking for?', 'Did anything confuse you?', '?Did the website look trustworthy?', 'What would you improve?', 'Would you consider using this website or service? Why?'],
  app: ['?Was the registration process easy?', 'Did you understand how to use the application?', '#How easy were the main features to find?', 'Did you encounter any bugs or errors?', 'Which feature did you find most useful?', 'What was the most confusing part?', 'What would you improve?'],
  survey: ['How familiar are you with this type of product?', '#How often do you experience this problem?', 'What solution do you currently use?', 'Which feature matters most to you?', '#How likely would you be to use a product like this?', 'What price would you consider reasonable?'],
  product: ['What is your first impression of this product?', 'What do you like most about it?', 'What would you change?', '?Does the product seem worth its price?', '?Would you consider purchasing it?', 'What would stop you from purchasing it?'],
  idea: ['?Have you experienced this problem?', 'How do you currently solve it?', '#How important is solving this problem to you?', '?Does the proposed solution make sense?', 'What concerns would you have?', '?Would you consider paying for a solution?', 'What would make the solution more useful?'],
  design: ['What is the first thing you notice?', 'What feeling does this design create?', 'Does it communicate the intended brand personality?', 'Which design option do you prefer?', '?Is the information easy to understand?', 'What would you change?']
};
const sq = type => SUGG[type].map(q => ({ q: q.replace(/^[#?]/, ''), h: '', t: q[0] === '#' ? 'rating' : q[0] === '?' ? 'yesno' : 'long', r: 1, o: [] }));
const QT = { text: 'Short answer', long: 'Long answer', yesno: 'Yes / No / Not sure', rating: 'Rating 1–5', choice: 'Single choice' };
const AGES = ['18–24', '25–34', '35–44', '45+'];
const REASONS = ['Did not follow campaign instructions', 'Activity appears incomplete', 'Evidence inconsistent with response', 'Irrelevant or inappropriate content', 'Copied or duplicated', 'Misrepresented experience'];
