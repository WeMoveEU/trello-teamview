templates: public/index.html public/authorize.html

public/index.html:
	sed -e "s/API_KEY/${TRELLO_API_KEY}/" templates/index.html > public/index.html

public/authorize.html:
	sed -e "s/API_KEY/${TRELLO_API_KEY}/" templates/authorize.html > public/authorize.html

