# TeamView Trello PowerUp

A Trello PowerUp to view on a single board all the assignments of the team.

## Setup guide
Clone this repository somewhere, and put your Trello API key in the `TRELLO_API_KEY` environment variable (does not need to be permanent).
Then run the make command to generate the public HTML files containing your key:
```
export TRELLO_API_KEY=blahblahblahblah
make
```

Then point a web server to the `public` directory, and [add the PowerUp to trello as a custom one](https://trello.com/power-ups/admin).

