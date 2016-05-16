

var async = require('async')

var Repository = require('openrdf-sesame-js').Repository

var bp = 'http://www.biopax.org/release/biopax-level2.owl#'

function BiopaxRDFStore(repoUrl) {

    this.repo = new Repository({
        uri: repoUrl
    })

    this.prefixes = [
        'PREFIX bp: <' + bp + '>'
    ]

}
BiopaxRDFStore.prototype = {
    getProtein: getProtein,
    getXRef: getXRef
}

module.exports = BiopaxRDFStore

function enumPredicateHandlers(summary, results, handlers, callback) {

    async.each(results, (result, next) => {

        var handler = handlers[result.p]

        if(handler)  {

            handler(result.o, summary, next)

        } else {

            console.log('unhandled predicate: ' + result.p)
            next()

        }

    }, (err) => {

        if(err)
            return callback(err)
        
        callback(null)
    })
}

function getProtein(uri, callback) {

    var summary = {
        name: '',
        synonyms: [],
        sequence: '',
        xrefs: []
    }

    var query = this.prefixes.concat([
        'SELECT ?p ?o WHERE {',
            '<' + uri + '> a bp:protein .',
            '<' + uri + '> ?p ?o',
        '}'
    ]).join('\n')

    console.log(query)

    this.repo.sparql(query, onProteinTriples.bind(this))

    function onProteinTriples(err, type, results) {

        if(err)
            return callback(err)

        var handlers = {

            [bp + 'NAME']: (name, summary, next) => {
                summary.name = name
                next()
            },
            
            [bp + 'SYNONYMS']: (synonym, summary, next) => {
                summary.synonyms.push(synonym)
                next()
            },

            [bp + 'SEQUENCE']: (sequence, summary, next) => {
                summary.sequence = sequence
                next()
            },

            [bp + 'XREF']: (uri, summary, next) => {

                this.getXRef(uri, (err, xref) => {

                    if(err)
                        return next(err)

                    summary.xrefs.push(xref)
                    next()
                })
            }

        }

        enumPredicateHandlers(summary, results, handlers, (err) => {

            if(err)
                callback(err)
            else
                callback(null, summary)

        })
    }
}

function getXRef(uri, callback) {

    var query = this.prefixes.concat([
        'SELECT ?p ?o WHERE {',
            '<' + uri + '> a bp:unificationXref .',
            '<' + uri + '> ?p ?o',
        '}'
    ]).join('\n')

    this.repo.sparql(query, onUnificationXrefTriples.bind(this))

    function onUnificationXrefTriples(err, type, results) {

        if(results.length === 0) {
            
            var query = this.prefixes.concat([
                'SELECT ?p ?o WHERE {',
                '<' + uri + '> a bp:relationshipXref .',
                '<' + uri + '> ?p ?o',
                '}'
            ]).join('\n')

            this.repo.sparql(query, onRelationshipXrefTriples.bind(this))

        } else {

            var summary = {
                type: 'unification',
                database: '',
                id: ''
            }

            var handlers = {

                [bp + 'DB']: (db, summary, next) => {
                    summary.database = db
                    next()
                },

                [bp + 'ID']: (id, summary, next) => {
                    summary.id = id
                    next()
                }
            }

            enumPredicateHandlers(summary, results, handlers, (err) => {

                if(err)
                    callback(err)
                else
                    callback(null, summary)
            })
        }
    }

    function onRelationshipXrefTriples(err, type, results) {

        var summary = {
            type: 'relationship',
            relationshipType: '',
            database: '',
            id: ''
        }

        var handlers = {

            [bp + 'DB']: (db, summary, next) => {
                summary.database = db
                next()
            },

            [bp + 'ID']: (id, summary, next) => {
                summary.id = id
                next()
            },

            [bp + 'RELATIONSHIP-TYPE']: (type, summary, next) => {
                summary.relationshipType = type
                next()
            }
        }

        enumPredicateHandlers(summary, results, handlers, (err) => {

            if(err)
                callback(err)
            else
                callback(null, summary)
        })
    }
}




