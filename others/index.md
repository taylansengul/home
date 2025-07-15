<link href='http://fonts.googleapis.com/css?family=Fauna+One' rel='stylesheet' type='text/
css'>
<link rel="stylesheet" href="../css/style.css" type="text/css" media="screen">
<script type="text/javascript" src="/scripts/emailpage.js"></script>
<link rel="stylesheet" href="http://yandex.st/highlightjs/7.3/styles/default.min.css">
<script src="http://yandex.st/highlightjs/7.3/highlight.min.js"></script>
# Index
+ [Personal](#personal)
+ [MacOS Terminal Tips](#macos)
+ [Python](#python)
+ [Web Stuff](#web)
+ [Algorithms](#algorithms)

<h2 id=personal> Personal </h2>
+ [Homepage](http://www.math.purdue.edu/~msengul/)
+ [ResearchGate](http://www.researchgate.net/profile/Taylan_Sengul/)
+ Uc Gitarlik Dinleti (with Cagatay Coker and Tolgahan Cogullu)
	+ [War](http://www.youtube.com/watch?v=emPpX8uhVi4)
	+ [Adelita](http://www.youtube.com/watch?v=_Rv7fhVcCHs)
	+ [Talijanska / Dark Eyes](http://www.youtube.com/watch?v=v3E8azJpvuM)
	+ [Erkan Ogur - Agirlama](http://www.youtube.com/watch?v=H4pBQBtcm0c)
	+ [Inti Illimani - Kalimba](http://www.youtube.com/watch?v=0okerFIK-aQ)
+ [Mathematics Genealogy Project](http://genealogy.math.ndsu.nodak.edu/id.php?id=166460)
+ [Rate My Professor](http://www.ratemyprofessors.com/ShowRatings.jsp?tid=1791655)
+ Yazilar:
	+ [Muzik Fizigi](http://eski.bgst.org/muzik/egitim/muzikfizigi.html)


<h2 id=python> Python </h2>
+ To download IPython for Mac or Windows.

	1. Download and install [Anaconda](http://continuum.io/downloads.html).
	2. Update IPython to the current version, using the Terminal application

		conda update conda	
		conda update ipython

+ ["Do you use the get/set pattern in Python?"](http://stackoverflow.com/questions/2579840/do-you-use-the-get-set-pattern)
The short answer is if all you need is simple accessing and setting the attributes then no.  
Ryan Tamyoko provides the long answer in his article [Getters/Setters/Fuxors](http://tomayko.com/writings/getters-setters-fuxors). (*May 24, 2013 3:49 AM*)

+ To save/load a data structure in memory
	+ Pickle module:
		+ Saving Data to a Pickle File
		
				import pickle
				with open('entry.pickle', 'wb') as f:  
				...     pickle.dump(entry, f)  
		+ Loading Data from a Pickle File  
				
				with open('entry.pickle', 'rb') as f:  
				...     entry2 = pickle.load(f)

	+ The data format used by the pickle module is Python-specific. For cross-language 		compatibility JSON format is ideal.


<h2 id=web> Web </h2>
Three pillars of web design: HTML, CSS and javascript. HTML is the semantics of the code. [Semantic code: What? Why? How?](http://boagworld.com/dev/semantic-code-what-why-how/)

+ Markdown
	+ There is [this](http://code.ahren.org/markdown-cheatsheet) markdown cheat sheet by Ahren 
	Code.
	+ Use Mou/[Showdown](http://softwaremaniacs.org/playground/showdown-highlight/).
	+ There is no readily available syntax in markdown for cross-reference (named anchor),
	[see](http://stackoverflow.com/questions/5319754/cross-reference-named-anchor-in-markdown).
	+ It is possible to nest code within a list using Markdown. 
	Just leave a blank line and then indent by 8 spaces as a minimum.
	+ Using Markdown in TextWrangler4 is possible, see [this](http://cantus.us/mac/using-markdown-in-textwrangler/).
	Be careful that text filters folder is not correctly written on this page. There should be no space between
	'Text' and 'Wrangler'.
	+ There is this javascript code [Strapdown](http://strapdownjs.com/) but I could not use inline code in it.

+ JavaScripts
	+ Code Highlighters: Take a look at a [comparison](http://softwaremaniacs.org/blog/2011/05/22/highlighters-comparison/en/) of various highlighters. For now, I use highlight.js. (*May 26, 2013 11:13 PM*)

	+ Some useful javascript codes are [here](http://9elements.com/io/index.php/a-box-of-javascript-chocolates-part-1/). (*May 26, 2013 11:14 PM*)

	+ Load MathJax for math display. (*May 26, 2013 11:18 PM*)
		<script type="text/javascript" src="http://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML">  
		</script>

+ CSS:
	+ [Normalize.css](http://necolas.github.io/normalize.css/) makes browsers render all elements more consistently and in line with modern standards. It precisely targets only the styles that need normalizing.
	
+ Text Editors:
	+ [Sublime Text 2 Tips and Tricks](http://hapkido.herokuapp.com/st2.html)
		
+ Design: 
	+ Columns layout: [Gridulator](http://gridulator.com/).
	+ Fonts: [Google fonts](http://www.google.com/fonts/#).
	+ For complete design: [Bootswatch](http://bootswatch.com/).
	+ Background gradient: As you might know, HTML5 introduced many exciting features for Web developers. One of the features is the ability to specify gradients using pure CSS3, without having to create any images and use them as repeating backgrounds for gradient effects. [Ultimate CSS Gradient Generator](http://www.colorzilla.com/gradient-editor/) is a powerful Photoshop-like CSS gradient editor from ColorZilla.

<h2 id=algorithms> Algorithms </h2>

+ [Algorithms 4th Edition](http://algs4.cs.princeton.edu/home/) looks 
like a good text book which is online and free. But one should be familiar with Java to 
learn this material. Luckily, the same authors (Robert Sedgewick and 
Kevin Wayne from Princeton?) also have a free online book on 
[Introduction to Programming in Java](http://introcs.cs.princeton.edu/java/home/). Also, 
the same material is on [Coursera]( href="https://www.coursera.org/course/algs4partI)
for free with video teaching. I personally prefer reading to watching.

+ [What are the very basic algorithms that every Computer Science student must be aware of?](http://www.quora.com/Algorithms/What-are-the-very-basic-algorithms-that-every-Computer-Science-student-must-be-aware-of?srid=X9WD&share=1)

+ [Problem Solving with Algorithms and Data Structures](http://interactivepython.org/courselib/static/pythonds/index.html) 
uses Python to teach basic algorithms and data structures. It is free and is extremely well prepared web site. (*May 26, 2013 11:21 PM*)
	+ Searching: The sequantial search is O(n). In an ordered list, one can use binary search
	which is a recursive strategy which yields O(logn). Hashing builds a data structure 
	that can be searched in O(1) (constant) time.
	+ Sorting: Several sorting algorithms are explained, analyzed and compared. Some of 
	them are O(n^2) while quick sort algorithm is O(nlogn).