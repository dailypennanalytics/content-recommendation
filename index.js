// Set up
// Setup Axios and API endpoints
const axios = require('axios');
const { response } = require('express');
axios.defaults.baseURL = 'https://www.thedp.com';

// Setup NLP
const winkNLP = require( 'wink-nlp');
const model = require( 'wink-eng-lite-web-model' );
const similarity = require('wink-nlp/utilities/similarity.js');
const nlp = winkNLP( model );
const its = nlp.its;
const as = nlp.as;

// Defining constants
const SECTIONS = ['news', 'academics', 'sports', 'opinion', 'administration', 'admissions', 'crime', 'student-life', 'identities', 'health', 'philadelphia'];

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
    let data = [];
    const origin = nlp.readDoc(article.content).tokens().out(its.value, as.bow)
    for (let i = 0; i < sections.length; i++) {
        const articles = await querySection(sections[i], 1, 20);
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

    return data.slice(0, 5);
}

// Perform recommendation (this can take a while)
recommendArticles('/article/2022/11/penn-director-of-admissions-departure-hamilton-college', SECTIONS).then( res => {
    for(let i = 0; i < res.length; i++) {
       console.log(res[i].slug)
       console.log(res[i].score)
    }
})