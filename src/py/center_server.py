#! /usr/bin/env python

import random
import json
import uuid
import socket

import tornado.ioloop
import tornado.tcpserver
import tornado.httpserver
import tornado.web

import imc.async
from imc.proxy import Proxy,Connection,imc_call,imc_call_async,imc_register_call

import netio
from netio import SocketStream,SocketConnection
from tojauth import TOJAuth

class Worker:
    def __init__(self,main_stream,linkclass,linkid,idendesc,worker_info,center_linkid):
        self.main_stream = main_stream
        self.linkclass = linkclass
        self.linkid = linkid
        self.idendesc = idendesc
        self.sock_addr = (worker_info['sock_ip'],worker_info['sock_port'])

        netio.send_pack(self.main_stream,bytes(json.dumps({
            'idendesc':self.idendesc,
            'center_linkid':center_linkid
        }),'utf-8'))

        conn = SocketConnection(self.linkclass,self.linkid,self.main_stream,self.sock_addr)
        conn.add_close_callback(lambda conn : self.close())
        Proxy.instance.add_conn(conn)

    def close(self):
        pass

class BackendWorker(Worker):
    def __init__(self,main_stream,linkid,idendesc,worker_info,center_linkid):
        global center_serv

        super().__init__(main_stream,'backend',linkid,idendesc,worker_info,center_linkid)
        self.ws_addr = (worker_info['ws_ip'],worker_info['ws_port'])

        center_serv.add_backend_worker(self)

    def close(self):
        global center_serv

        center_serv.del_backend_worker(self)
        print('disconnect')

class CenterServer(tornado.tcpserver.TCPServer):
    def __init__(self):
        super().__init__()

        self._ioloop = tornado.ioloop.IOLoop.instance()
        self._linkid_usemap = {}
        self._worker_linkidmap = {}
        self._backend_clientmap = {}
        self._backend_workerlist = []

        pubkey = open('pubkey.pem','r').read()
        privkey = open('privkey.pem','r').read()
        TOJAuth(pubkey,privkey)

        self._linkid = self._create_linkid()

        self._idendesc = TOJAuth.instance.create_iden('center',self._linkid,1,TOJAuth.ROLETYPE_TOJ)
        Proxy('center',self._linkid,TOJAuth.instance,self._idendesc)

        imc_register_call('','lookup_linkid',self._lookup_linkid)
        imc_register_call('','create_iden',self._create_iden)
        imc_register_call('','add_client',self._add_client)
        imc_register_call('','del_client',self._del_client)

        imc_register_call('','test_dst',self._test_dst)
        imc_register_call('','test_dstb',self._test_dstb)

    def handle_stream(self,stream,addr):
        def _recv_worker_info(data):
            worker_info = json.loads(data.decode('utf-8'))

            linkclass = worker_info['linkclass']
            if linkclass == 'backend':
                linkid = self._create_linkid()
                idendesc = TOJAuth.instance.create_iden('backend',linkid,1,TOJAuth.ROLETYPE_TOJ)
                BackendWorker(main_stream,linkid,idendesc,worker_info,self._linkid)

        fd = stream.fileno()
        self._ioloop.remove_handler(fd)
        main_stream = SocketStream(socket.fromfd(fd,socket.AF_INET,socket.SOCK_STREAM | socket.SOCK_NONBLOCK,0))

        netio.recv_pack(main_stream,_recv_worker_info)

    def add_backend_worker(self,backend):
        backend_linkid = backend.linkid

        self._worker_linkidmap[backend_linkid] = backend
        self._backend_clientmap[backend_linkid] = {}
        self._backend_workerlist.append(backend)
    
    def del_backend_worker(self,backend):
        backend_linkid = backend.linkid

        del self._worker_linkidmap[backend_linkid]
        del self._backend_clientmap[backend_linkid]
        self._backend_workerlist.remove(backend)

    def dispatch_client(self):
        size = len(self._backend_workerlist)
        if size == 0:
            return None

        linkid = self._create_linkid()
        idendesc = TOJAuth.instance.create_iden('client',linkid,2,TOJAuth.ROLETYPE_GUEST)
        backend = self._backend_workerlist[random.randrange(size)]
        ws_ip,ws_port = backend.ws_addr

        return (idendesc,backend.linkid,ws_ip,ws_port)

    def _create_linkid(self):
        linkid = uuid.uuid1()
        while linkid in self._linkid_usemap:
            linkid = uuid.uuid1()
        
        linkid = str(linkid)
        self._linkid_usemap[linkid] = True

        linkid = str(len(self._linkid_usemap))

        return linkid

    @imc.async.caller
    def _lookup_linkid(self,linkid):
        try:
            worker = self._worker_linkidmap[linkid]

            #a = int(iden['linkid'])
            #b = int(linkid)

            #if b > a:
            #    worker = self._worker_linkidmap[str(a + 1)]

            #else:
            #    worker = self._worker_linkidmap[str(a - 1)]

            if TOJAuth.get_current_iden()['linkclass'] != 'client':
                sock_ip,sock_port = worker.sock_addr
                return {
                    'worker_linkclass':worker.linkclass,
                    'worker_linkid':worker.linkid,
                    'sock_ip':sock_ip,
                    'sock_port':sock_port
                }

        except KeyError:
            return None

    @imc.async.caller
    @TOJAuth.check_access(1,TOJAuth.ACCESS_EXECUTE)
    def _create_iden(self,linkclass,linkid,idenid,roletype,payload):
        return TOJAuth.instance.create_iden(linkclass,linkid,idenid,roletype,payload)
        
    @imc.async.caller
    def _add_client(self,param):
        backend_linkid = iden['linkid']
        client_linkid = param['client_linkid']

        self._backend_clientmap[backend_linkid][client_linkid] = True
        conn = Proxy.instance.get_conn(backend_linkid)
        Proxy.instance.link_conn(client_linkid,conn)

        print(client_linkid);

    @imc.async.caller
    def _del_client(self,param):
        backend_linkid = iden['linkid']
        client_linkid = param

        del self._backend_clientmap[backend_linkid][client_linkid]
        conn = Proxy.instance.get_conn(client_linkid)
        Proxy.instance.unlink_conn(client_linkid)



    
    @imc.async.caller
    def _test_dst(self,param):
        linkidlist = []
        clientmaps = self._backend_clientmap.values()
        for clientmap in clientmaps:
            linkids = clientmap.keys()
            for linkid in linkids:
                linkidlist.append(linkid)

        return linkidlist

    @imc.async.caller
    def _test_dstb(self,param):
        return param + ' World'

class WebConnHandler(tornado.web.RequestHandler):
    def set_default_headers(self):
        self.set_header('Access-Control-Allow-Origin','*')

    def post(self):
        global center_serv

        data = center_serv.dispatch_client()
        if data == None:
            self.write('Eno_backend')
        else:
            client_idendesc,backend_linkid,ip,port = data
            self.write(json.dumps({
                'client_idendesc':client_idendesc,
                'backend_linkid':backend_linkid,
                'ip':ip,
                'port':port
            }))

if __name__ == '__main__':
    global center_serv

    center_serv = CenterServer()
    center_serv.listen(5730)

    http_serv = tornado.httpserver.HTTPServer(tornado.web.Application([
        ('/conn',WebConnHandler),
    ]))
    http_serv.listen(83)

    tornado.ioloop.IOLoop.instance().start()
