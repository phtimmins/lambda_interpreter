

function Var(id) {
    this.type = 'var';
    this.id = id;
}

function App(func, arg) {
    this.type = 'app';
    this.func = func;
    this.arg = arg;
}

function Abs(v, expr) {
    this.type = 'abs';
    this.var = v;
    this.expr = expr;
}

function pretty_str_expr(expr) {
    switch (expr.type) {
        case 'var': return expr.id;
        case 'app': return "App(" + pretty_str_expr(expr.func) + ", " + pretty_str_expr(expr.arg) + ")";
        case 'abs': return "Abs(" + pretty_str_expr(expr.var) + ", " + pretty_str_expr(expr.expr) + ")";
        default:    console.log("somethings wrong: " + expr + " " + expr.type);
    }
}

function pretty(prog_str) {
    return pretty_str_expr(shunting_yard(separate_tokens(prog_str)));
}

function tests() {
    test(pretty('x x'), 'App(x, x)');
    test(pretty('\\x.x'), 'Abs(x, x)');
    test(pretty('(\\x.x)'), 'Abs(x, x)');
    test(pretty('(\\x.a b) (\\y.b)'), 'App(Abs(x, App(a, b)), Abs(y, b))');
    test(pretty('(\\s.a (b c))'), 'Abs(s, App(a, App(b, c)))');
    test(pretty('x x x'), 'App(App(x, x), x)');
    test(pretty('(\\x.x z) \\y.w \\w.w x y z'), 'App(Abs(x, App(x, z)), Abs(y, App(w, Abs(w, App(App(App(w, x), y), z)))))');
    test(pretty('(\\x.x z) (\\y.w \\w.w x y z)'), 'App(Abs(x, App(x, z)), Abs(y, App(w, Abs(w, App(App(App(w, x), y), z)))))');
    //(lambda x.x z) lambda y.w lambda w.w x y z
    //(lambda x. (x z)) (lambda y. (w (lambda w. (((w x) y) z))))
}



function test(a, b) {
    console.log(a != b ? 'failed: ' + a + " != " + b : 'pass');
}

function whil(stack, output, condition) {
    while(stack.length > 0 && condition()) {
        var top = stack.pop();
        if(top == ".") {
            var s = output.pop();
            var f = output.pop();
            output.push(new Abs(f, s));
        }
        else if(/\s+/.test(top)) {
            var s = output.pop();
            var f = output.pop();
            output.push(new App(f, s));
        }
        else {
            output.push(new Var(top));
        }
    }
}

function shunting_yard(tokens) {
    var output = [];
    var stack = [];
    while(tokens.length > 0) {
        var current = tokens.shift();

        if(current.match(/\w+/)) {
            output.push(new Var(current));
        }
        else if(current.match(/\s+/)) {
            while(stack.length > 0  && (stack[stack.length-1].match(/\s+/))) {
                var top = stack.pop();
                if(top == ".") {
                    var s = output.pop();
                    var f = output.pop();
                    output.push(new Abs(f, s));
                }
                else if(/\s+/.test(top)) {
                    var s = output.pop();
                    var f = output.pop();
                    output.push(new App(f, s));
                }
            }
            stack.push(current);
        }
        else if(current == "(" || current == '.') {
            stack.push(current);
        }
        else if(current == ")") {
            while(stack.length > 0 && stack[stack.length-1] != "(") {
                var top = stack.pop();
                if(top == ".") {
                    var s = output.pop();
                    var f = output.pop();
                    output.push(new Abs(f, s));
                }
                else if(/\s+/.test(top)) {
                    var s = output.pop();
                    var f = output.pop();
                    output.push(new App(f, s));
                }
                else {
                    console.log('shouldnt happen')
                }
            }
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
        while(stack.length > 0) {
            var top = stack.pop();
            if(top == '.') {
                var s = output.pop();
                var f = output.pop();
                output.push(new Abs(f, s));
            }
            else if(/\s+/.test(top)) {
                var s = output.pop();
                var f = output.pop();
                output.push(new App(f, s));
            }
            else {
                console.log('shouldnt happen')
            }
        }
    }
    return output[0];
}


function lower_prec(o1, o2) {
    if(o1 == '.' && o2 == '.') {
        return false;
    }
    else if(o1 == '.' && o2 == ' ') {
        return false;
    }
    else if(o1 == ' ' && o2 == ' ') {
        return true;
    }
    else if(o1 == ' ' && o2 == '.') {
        return false;
    }
}


function shunting_yard_ast(tokens) {
    var output = [];
    var stack = [];
    while (tokens.length > 0) {
        var current = tokens.shift();

        if (current.match(/\w+/)) {
            output.push(new Var(current));
        }
        else if (current == "." || current.match(/\s+/)) {

            //move_from_stack_to_output_while(stack, output, function () { return stack[stack.length - 1].match(/\s+/) })
            while (stack.length > 0 && stack[stack.length - 1].match(/\s+/)) {
                stack.pop();
                output.push(app_swap_order(output.pop(), output.pop()));
            }
            stack.push(current);
        }
        else if (current == "(") {
            stack.push(current);
        }
        else if (current == ")") {
            //var paren_index =  stack.lastIndexOf('(');
            //if(paren_index != -1) {
                //move_from_stack_to_output_while(stack, output, function () { return stack[stack.length-1] != '(' })
                //move_from_stack_to_output(stack, output, paren_index+1)

            while (stack.length > 0 && stack[stack.length-1] != '(') {
                var top = stack.pop();
                if (top == ".") {
                    output.push(abs_swap_order(output.pop(), output.pop()));
                }
                else if (top.match(/\s+/)) {
                    output.push(app_swap_order(output.pop(), output.pop()));
                }
                else {
                   output.push(new Var(top));
                }
            }

            stack.pop(); // pop off left paren
            //}
            //else {
            //    console.log("mismatched parenthesis");
            if(stack.length == 0) {console.log("mismatched parenthesiss")}

            //}
        }
    }

    if (stack.indexOf('(') != -1 || stack.indexOf(')') != -1) {
        console.log("mismatched parenthesis");
    }
    else {

            while (stack.length > 0) {
                var top = stack.pop();
                if (top == ".") {
                    output.push(abs_swap_order(output.pop(), output.pop()));
                }
                else if (top.match(/\s+/)) {
                    output.push(app_swap_order(output.pop(), output.pop()));
                }
                else {
                   output.push(new Var(top));
                }
            }
        //move_from_stack_to_output(stack, output, 0)
    }
    return output[0];
}

// all spaces are lambda application => whitespace matters
function separate_tokens(prog_str) {
    return prog_str.split(/(\)|\(|\\|\.|\w+|\s+)/).filter(function (t) {return t != ''});
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
    "Normal" : function () {},
    "Pass by Value" : function () {},
    "Pass by Reference" : function () {}
};

function set_strategy(strategy) {
    $("#strategies").text(strategy);
}

$(function() {

    set_strategy(Object.keys(evaluation_stategies)[0]);

    $(".dropdown-menu li a").click(function () {
        set_strategy($(this).text());
    });
});

$.each(evaluation_stategies, function(name, func) {
    $("#strategies_dropdown").append("<li><a href=\"#\">" + name+ "</a></li>");
});

$("#eval_button").click(function(){
    var expr = $("#expression").val();
    var tokens = separate_tokens(expr);
    var shunted = shunting_yard_ast(tokens);
    console.log("ast: " + JSON.stringify(shunted));
    console.log("pretty: " + pretty_str_expr(shunted));
});

$("#step_button").click(function(){
    console.log(pretty_str_expr(shunting_yard_ast(separate_tokens("(\\x.(\\d.x) x)"))));
});
