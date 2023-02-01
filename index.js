// Set up
// Setup Axios and API endpoints
const axios = require('axios');
const { response, query } = require('express');
axios.defaults.baseURL = 'https://www.thedp.com';

// Setup NLP
const winkNLP = require( 'wink-nlp');
const model = require( 'wink-eng-lite-web-model' );
const similarity = require('wink-nlp/utilities/similarity.js');
const nlp = winkNLP( model );
const its = nlp.its;
const as = nlp.as;

// Defining constants
const SECTIONS = ['news', 
                'academics', 
                'sports', 
                'opinion',
                'administration', 
                'admissions', 
                'crime', 
                'studentlife', 
                'identities', 
                'health', 
                'philadelphia', 
                'politics', 
                'housing-dining', 
                'breaking', 
                'centerpiece', 
                'greek-life'];

// Helpers
const cleanText = (text) => {
    text = text.replace(/(<([^>]+)>)/gi, '');
    text = text.replace(/&nbsp;/g, '');
    text = text.replace(/\r?\n|\r/g, '');
    return text;
}

// Querying articles based on sections e.g news, sports,..
const querySection = async (section, page, articlePerPage) => {
    const query = await axios.get(`/section/${section}.json?page=${page}&per_page=${articlePerPage}`)
    query.data.articles.map( article => {
        article.content = cleanText(article.content);
        return article;
    })
    return query.data.articles;
}

// Recommend articles based on text cosine similarity
const recommendArticles = async (articleURL, sections) => {
    const query = await axios.get(`${articleURL}.json`);
    const article = query.data.article;
    article.content = cleanText(article.content);

    // only querying tags that the article has to be faster
    let tags = []; 
    for (const tag of article.tags) {
        tags.push(tag.name)
    }

    let tagsFiltered = tags.filter(value => SECTIONS.includes(value));
    
    let data = [];
    const origin = nlp.readDoc(article.content).tokens().out(its.value, as.bow)
    for (let i = 0; i < tags.length; i++) {
        const articles = await querySection(tagsFiltered[i], 1, 50);
        for (const item of articles) {
            if (item.slug == article.slug) {
                continue;
            }
            data.push(item);
        }
    }

    data = [...new Map(data.map(v => [v.slug, v])).values()]
  
    for (let i = 0; i < data.length; i++) {
        const target = nlp.readDoc(data[i].content).tokens().out(its.value, as.bow);
        data[i].score = similarity.bow.cosine(origin, target);
    }

    data = data.sort((a, b) => b.score - a.score);

    // sorting top 10 more similar articles by popularity 
    data = data.slice(0, 10).sort((a, b) => b.hits - a.hits);

    // sorting the 5 remaining articles by slug similarity 
    data = data.slice(0, 5);

    for (let i = 0; i < data.length; i++) {
        const target = nlp.readDoc(data[i].slug).tokens().out(its.value, as.bow);
        data[i].slugScore = similarity.bow.cosine(origin, target);
    }

    data = data.sort((a, b) => b.slugScore - a.slugScore)
    return data;
}

// Perform recommendation (this can take a while)
recommendArticles('/article/2022/09/fossil-free-penn-uc-townhomes-encampment-teach-in', SECTIONS).then( res => {
    for(let i = 0; i < res.length; i++) {
       console.log(res[i].slug)
       console.log(res[i].score)
       console.log(res[i].hits)
    }
})

