
function Var(id) {
    this.type = 'var';
    this.id = id;
    this.free_vars = {};
    this.free_vars[id] = true;
}

function App(func, arg) {
    this.type = 'app';
    this.func = func;
    this.arg = arg;
    this.free_vars = {};
    _.extend(this.free_vars, func.free_vars);
    _.extend(this.free_vars, arg.free_vars);
}

function Abs(v, expr) {
    this.type = 'abs';
    this.var = v;
    this.expr = expr;
    this.free_vars = {};
    _.extend(this.free_vars, expr.free_vars);
    delete this.free_vars[this.var.id];
}

// pretty print
// unnecessary parenthesises uses in some abstractions
function pp(expr) {
     switch (expr.type) {
        case 'var': return expr.id;
        case 'abs': return '(\\' + expr.var.id + '.' + pp(expr.expr) + ')';
        case 'app':
            return pp(expr.func) + ' ' + (expr.arg.type == 'app' ? '('+pp(expr.arg)+')' : pp(expr.arg));
    }
}

function pretty_str(expr) {
    switch (expr.type) {
        case 'var': return expr.id;
        case 'app': return "App(" + pretty_str(expr.func) + ", " + pretty_str(expr.arg) + ")";
        case 'abs': return "Abs(" + pretty_str(expr.var) + ", " + pretty_str(expr.expr) + ")";
    }
}

function fixpoint(stepper) {
    return function (expr) {
        var expr_evaled = stepper(expr);
        while(expr_evaled.stepped) {
            expr_evaled = stepper(expr_evaled.node);
        }
        return expr_evaled;
    };
}

var redexes = 0;

function normal_step(node) {
    switch (node.type) {
        case 'var': return { stepped: false, node: node };
        case 'app':
            switch(node.func.type) {
                case 'var':
                case 'app':
                    var func_evaled = normal_step(node.func);
                    if (func_evaled.stepped) {
                        return {stepped: true, node: new App(func_evaled.node, node.arg)};
                    }
                    var arg_evaled = normal_step(node.arg);
                    return { stepped: arg_evaled.stepped, node: new App(node.func, arg_evaled.node) };
                case 'abs': // redex
                    redexes++;
                    return {stepped: true, node: substitute(node.arg, node.func.var, node.func.expr)}
            }
        case 'abs':
            var expr_evaled = normal_step(node.expr);
            return { stepped : expr_evaled.stepped, node : new Abs(node.var, expr_evaled.node) };
    }
}

// sub e for x (variable) in expr
function substitute(e, x, expr) {
    switch (expr.type) {
        case 'var' :    return expr.id == x.id ? e : expr;
        case 'app' :    return new App(substitute(e, x, expr.func), substitute(e, x, expr.arg));
        case 'abs' :
            if(expr.var.id == x.id) {
                return expr;
            }
            else if(!(expr.var.id in e.free_vars)) {
                return new Abs(expr.var, substitute(e, x, expr.expr));
            }
            else {
                do {
                    var z = rename(expr.var.id);
                } while(z in e.free_vars || z in variables(expr.expr));
                return new Abs(new Var(z), substitute(e, x, substitute(new Var(z), expr.var, expr.expr)));
            }
    }
}

function rename(y) {
    var res = /^(.*?)([\d]*)$/.exec(y);
    var prefix = res[1];
    var num = res[2];
    return prefix + (num == '' ? 1 : parseInt(num) + 1);
}

function variables(expr) {
    switch (expr.type) {
        case 'var' :
            var var_vars = {};
            var_vars[expr.id] = true;
            return var_vars;
        case 'app' :
            return _.extend(variables(expr.func), variables(expr.arg));
        case 'abs' :
            var abs_vars = variables(expr.expr);
            abs_vars[expr.var.id] = true;
            return abs_vars;
    }
}

function move_from_stack_to_output_while(stack, output, condition) {
    while(stack.length > 0 && condition()) {
        var top = stack.pop();
        var s = output.pop();
        var f = output.pop();
        output.push(top == '.' ? new Abs(f, s) : new App(f, s));
    }
}

// shunting yard algorithm
function parse(tokens) {
    var output = [];
    var stack = [];
    while(tokens.length > 0) {
        var current = tokens.shift();

        if(current.match(/\w+/)) {
            output.push(new Var(current));
        }
        else if(current.match(/\s+/)) { // only swap if both o1 and o2 are application
            move_from_stack_to_output_while(stack, output, function() {return stack[stack.length-1].match(/\s+/)} );
            stack.push(current);
        }
        else if(current == "(" || current == '.') {
            stack.push(current);
        }
        else if(current == ")") {
            move_from_stack_to_output_while(stack, output, function() {return stack[stack.length-1] != '('} );
            if(stack.length == 0) {
                console.log("mismatched parenthesis");
            }
            stack.pop(); // pop off left paren
        }
    }
    if(stack.indexOf('(') != -1 || stack.indexOf(')') != -1) {
        console.log("mismatched parenthesis");
    }
    else {
        move_from_stack_to_output_while(stack, output, function() {return true} );
    }
    return output.pop();
}

// all spaces are lambda application => whitespace matters
function separate_tokens(prog_str) {
    return prog_str.split(/(\)|\(|\\|\.|\w+|\s+)/).filter(function (t) {return t != ''});
}

/*


         (     )     .     x
    (    ((n   ()i   (.i   (xn
    )    )(a   ))n   ).i   )xa
    .    .(n   .)i   ..i   .xn
    x    x(a   x)n   x.n   xxa


    application:   )(   x(   )x  xx
    nothing:   ((   .(   ))  x)  x.  (x  .x   start    end
    illegal:   ()   .)   (.  ).  ..


    complain if anything illegal
    split on whitespace
    tokenize into tokens
    complain if two tokens are adjacent that shouldn't be
    remove extraneous whitespace

*/
function ll(expr) {
    var illegal_tokens = /[^\)\(\.\w\s]+/g;
    var res = illegal_tokens.exec(expr);
    if(res) {
        return { result: expr, msg: 'Illegal input \'' + res[0] + '\' at index ' + res.index };
    }

    var tok_strs = _.reject(expr.split(/(\)|\(|\\|\.|\w+|\s+)/g), function (t) {
        return t == '' || /\s+/.test(t);
    });

    var tokens = [];
    var res = _.reduce(tok_strs, function(tokens, num) {
        if(memo == [] && (num == '.' || num == ')')) {
            return {result: expr, msg: 'should start with . or )'};
        }
        else if(/[\(\.]/.test(tokens[tokens.length-1]) && num == ')' ||
                /[\(\)\.]/.test(tokens[tokens.length-1]) && num == '.') {
            return { result: expr, msg: 'should start with . or )' };
        }
        tokens.push(num);
        return tokens;
    }, []);


}

function remove_extra_spaces(program) {
    return program
        .replace(/\(\s+\\/g, '(\\')
        .replace(/\(\s+(\w+)/g, '\($1')
        .replace(/\\\s+(\w+)/g, '\\$1')
        .replace(/(\w+)\s+\./g, '$1.')
        .replace(/\.\s+(\w+)/g, '.$1')
        .replace(/\.\s+\\/g, '.\\')
        .replace(/(\w+)\s+\)/g, '$1\)')
        .replace(/\)\s+\)/g, '\)\)')
        .replace(/\(\s+\(/g, '\(\(');
}

function lex(program) {
    program = remove_extra_spaces($.trim(program));
    console.log(program);
    var tokens = [];
    var res;
    var regex = /\)|\(|\\|\.|\w+|\s+/g;
    //var regex = /\)|\(|\\|\.|\w+|\s+|[^\)\(\.\w\s]+/g;
    while ((res = regex.exec(program)) !== null) {
        tokens.push(res[0]);
    }
    return tokens;
}

// all spaces are lambda application => whitespace matters
function lex_assume_correct(program) {
    var tokens = [];
    var res;
    var regex = /\(|\)|\\|\.|\w+|\s+/g;
    while ((res = regex.exec(program)) !== null) {
        tokens.push(res[0]);
    }
    return tokens;
}

var evaluation_stategies = {
    "Normal" : normal_step
};



var lambdaEditor;

$(function() {

    $("#strategies").text(Object.keys(evaluation_stategies)[0]);

    $(".dropdown-menu li a").click(function () {
        $("#strategies").text($(this).text());
    });

    $("#eval_button").mouseup(function(){
        $(this).blur();
    })
    $("#step_button").mouseup(function(){
        $(this).blur();
    })


    CodeMirror.defineSimpleMode("lambda", {
            start: [
                {regex: /\w+/, token: "variable"},
                {regex: /\(|\)/, token: "paren"},
                {regex: /\\|\./, token: "slash_dot"}
            ]
    });

    //lambdaEditor = CodeMirror.fromTextArea(document.getElementById("expression"), {

    lambdaEditor = CodeMirror(document.getElementById("code"), {
        lineWrapping: true,
//        value: '(\\m.\\n.\\f.\\x.m f (n f x)) (\\f.\\x.f (f x)) (\\f.\\x.f (f (f x)))',
        value: '(\\f.(\\x.f (x x)) (\\x.f (x x))) (\\fact.\\c.(\\n.n (\\x.\\a.\\b.b) (\\a.\\b.a)) c (\\f.\\x.f x) ((\\m.\\n.\\f.m (n f)) c (fact ((\\n.\\f.\\x.n (\\g.\\h.h (g f)) (\\u.x) (\\u.u)) c)))) (\\f.\\x.f (f (f (f (f x)))))',
        mode:  "lambda",
        theme: "expr",
        matchBrackets: true,
      //  keyMap: 'vim'
    });


});

$.each(evaluation_stategies, function(name, func) {
    $("#strategies_dropdown").append("<li><a href=\"#\">" + name+ "</a></li>");
});

function run(evaluator, expr) {
    if (expr != '') {
        var t = new Date().getTime();
        var tokens = lex(expr);
        var parsed = parse(tokens);
        var evaled = evaluator(parsed).node;
        var delay = new Date().getTime() - t;
        console.log('delay: ' + delay);
        return pp(evaled);
    }
}

$("#eval_button").click(function(){
    var stepper = evaluation_stategies[$("#strategies").text()];
    lambdaEditor.setValue(run(fixpoint(stepper), lambdaEditor.getValue()));
    console.log('redexes: ' + redexes);
});


$("#step_button").click(function(){
    var stepper = evaluation_stategies[$("#strategies").text()];
    lambdaEditor.setValue(run(stepper, lambdaEditor.getValue()));
});


