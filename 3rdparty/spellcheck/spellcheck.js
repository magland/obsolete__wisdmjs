require('typo.js');
require('extra_words.js');

function SPELLCHECKER() {
	var that=this;
	var m_dictionary=null;
	var m_extra_words=extra_words();
	var m_extra_words_lookup={};
	for (var i=0; i<m_extra_words.length; i++) m_extra_words_lookup[m_extra_words[i].toLowerCase()]=true;
	
	this.initialize=function(callback) {
		if (!m_dictionary)
			m_dictionary=new Typo("en_US",undefined,undefined,{platform:'any',dictionaryPath:'$resources$/typo/dictionaries'});
		callback();
	};
	var is_number=function(word) {
		var num=Number(word);
		if (num===0) return true;
		if (num) return true;
		return false;
	};
	this.check=function(word) {
		word=word.toLowerCase();
		if (m_extra_words_lookup[word]) return true;
		if (is_number(word)) return true;
		if (!m_dictionary) return null;
		return m_dictionary.check(word);
	};
}
