# Lifeform Generator - a JavaScript Experiment
Just some fun with JavaScript and a genetic type life simulator idea.

I'm still learning JavaScript and certain areas just never seem to become commonplace in my day-to-day work so, I thought of this being a way to get out of my JS comfort zone and learn some of the concepts that I've typically shied away from.

# Thanks
Thanks to Dave Miller's YouTube video and github repository for providing the inspiration and variable names along with many other ideas for this learning project.

https://github.com/davidrmiller/biosim4

# General Notes from the video and my own thoughts.
* self-replication
* blueprint -- genome
* inherit blueprint
* mutations
* selection, natural or otherwise

Genomes are collection of genes:
one gene = 8-hexadecimal digits ########
32 binary bits of data
f 1 3 5 1 f e 3

e.g.
[1|1|1|1] [0|0|0|1] [0|0|1|1] [0|1|0|1] 
[0|0|0|1] [1|1|1|1] [1|1|1|0] [0|0|1|1]

bit 1       = source type [input sensory or internal neuron]
bit 2 - 8   = source ID (take modulo of number of neurons to find out which one it refers to????)
bit 9       = sink (action) type
bit 10 - 16 = sink ID

bit 17 - 32 = 16-bit signed integer weight of the connection (divide this by 8000 or so) to get to a floating point value -4.0 -> 4.0
